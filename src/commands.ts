import * as path from "path";
import * as fs from "fs";
import {
  printInfo,
  printSuccess,
  printWarning,
  printError,
  promptYesNo,
} from "./utils";
import {
  generateContainerName,
  imageExists,
  buildImageRaw,
  containerExists,
  containerRunning,
  stopContainer,
  startContainer,
  removeContainer,
  createNewContainer,
  execInteractive,
  execNonInteractive,
  stopContainerIfLastSession,
  listContainersRaw,
  getStoppedContainerIds,
  removeContainersById,
  IMAGE_NAME,
  IMAGE_TAG,
} from "./docker";
import {
  ensureConfigDir,
  loadSettings,
  saveSettings,
  copyConfigs,
} from "./config";
import { ensureMountsFile } from "./mounts";

type ContainerState = "running" | "started" | "created";

function ensureProjectDirectory(projectPath: string): void {
  if (!fs.existsSync(projectPath) || !fs.statSync(projectPath).isDirectory()) {
    printError(
      `Project directory does not exist or is not a directory: ${projectPath}`
    );
    process.exit(1);
  }
}

function ensureProjectContainer(projectPath: string): {
  containerName: string;
  projectName: string;
  state: ContainerState;
} {
  const containerName = generateContainerName(projectPath);
  const projectName = path.basename(projectPath);

  ensureProjectDirectory(projectPath);
  ensureConfigDir();

  if (!imageExists()) {
    printWarning("Docker image not found. Building...");
    buildImage();
  }

  if (containerRunning(containerName)) {
    return { containerName, projectName, state: "running" };
  }

  if (containerExists(containerName)) {
    printInfo(`Starting existing container: ${containerName}`);
    startContainer(containerName);
    return { containerName, projectName, state: "started" };
  }

  printInfo(`Creating new container: ${containerName}`);
  printInfo(`Project: ${projectPath}`);

  if (!createNewContainer(containerName, projectName, projectPath)) {
    printError("Failed to create container");
    process.exit(1);
  }

  return { containerName, projectName, state: "created" };
}

export function buildImage(): void {
  printInfo(`Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}`);
  if (!buildImageRaw()) {
    printError("Failed to build Docker image");
    process.exit(1);
  }
  printSuccess("Docker image built successfully");
}

export async function init(isStartup: boolean = false): Promise<void> {
  const settings = loadSettings();

  if (isStartup) {
    // If startup: Check if completedInit, if not, prompt.
    if (!settings.completedInit) {
      printInfo("First run detected. Would you like to copy config files?");
      printInfo(
        "This will copy your OpenCode, Codex, Claude Code, & Gemini CLI configs to ~/.code-container/configs for mounting."
      );
      printInfo(
        "If you choose to not copy config files, you can still setup your harness once inside the container."
      );

      const shouldCopy = await promptYesNo("Copy config files?");
      if (shouldCopy) {
        copyConfigs();
        printSuccess("Config files copied successfully");
      } else {
        printInfo("Ignoring copy. Run `container init` to copy.");
      }
    }
    settings.completedInit = true;
    saveSettings(settings);
  } else {
    // Else, not startup; user ran container init
    if (!settings.completedInit) {
      printInfo("Copying config files to ~/.code-container/configs...");
      copyConfigs();
      printSuccess("Config files copied successfully");

      settings.completedInit = true;
      saveSettings(settings);
    } else {
      printWarning(
        "Config files already exist. This operation will merge and overwrite existing config files."
      );
      const shouldCopy = await promptYesNo("Continue?");
      if (shouldCopy) {
        copyConfigs();
        printSuccess("Config files copied successfully");
      }
    }
  }
}

export async function runContainer(projectPath: string): Promise<void> {
  await ensureMountsFile();
  const { containerName, projectName, state } = ensureProjectContainer(
    projectPath
  );

  if (state === "running") {
    printInfo(`Container '${containerName}' is already running`);
    printInfo("Attaching to container...");
    execInteractive(containerName, projectName);
    stopContainerIfLastSession(containerName, projectName);
    return;
  }

  execInteractive(containerName, projectName);
  stopContainerIfLastSession(containerName, projectName);
  printSuccess("Container session ended");
}

export async function execInContainer(
  projectPath: string,
  command: string[]
): Promise<number> {
  await ensureMountsFile();
  const { containerName, projectName, state } = ensureProjectContainer(
    projectPath
  );

  const exitCode = execNonInteractive(containerName, projectName, command);

  if (state !== "running") {
    stopContainerIfLastSession(containerName, projectName);
  }

  return exitCode;
}

export function stopContainerForProject(projectPath: string): void {
  const containerName = generateContainerName(projectPath);

  if (!containerExists(containerName)) {
    printError(`Container does not exist: ${containerName}`);
    process.exit(1);
  }

  if (containerRunning(containerName)) {
    printInfo(`Stopping container: ${containerName}`);
    stopContainer(containerName);
    printSuccess("Container stopped");
  } else {
    printWarning(`Container is not running: ${containerName}`);
  }
}

export function removeContainerForProject(projectPath: string): void {
  const containerName = generateContainerName(projectPath);

  if (!containerExists(containerName)) {
    printError(`Container does not exist: ${containerName}`);
    process.exit(1);
  }

  if (containerRunning(containerName)) {
    printInfo(`Stopping container: ${containerName}`);
    stopContainer(containerName);
  }

  printInfo(`Removing container: ${containerName}`);
  removeContainer(containerName);
  printSuccess("Container removed");
}

export function listContainers(): void {
  printInfo("Code Containers:");
  listContainersRaw();
}

export function cleanContainers(): void {
  printInfo("Removing all stopped Code containers...");
  const containerIds = getStoppedContainerIds();

  if (containerIds.length === 0) {
    printInfo("No stopped Code containers to remove");
    return;
  }

  removeContainersById(containerIds);
  printSuccess("Cleanup complete");
}
