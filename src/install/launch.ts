import chalk from 'chalk';
import { spawn } from 'child_process';
import * as path from 'path';

import {
  buildTools,
  installerScriptPath,
  isBuildToolsInstalled,
  isDryRun,
  isPythonInstalled
} from '../constants';
import { log } from '../logging';
import { getBuildToolsInstallerPath } from '../utils/get-build-tools-installer-path';
import { getBuildToolsExtraParameters } from '../utils/get-build-tools-parameters';
import { getPythonInstallerPath } from '../utils/get-python-installer-path';

const debug = require('debug')('windows-build-tools');

const vccInstaller = getBuildToolsInstallerPath();
const pythonInstaller = getPythonInstallerPath();

/**
 * Launches the installer, using a PS1 script as a middle-man
 *
 * @returns {Promise<void>} - Promise that resolves once done
 */
export function launchInstaller(): Promise<void> {
  return new Promise((resolve, reject) => {
    const vccParam = `-VisualStudioVersion '${buildTools.version.toString()}'`;
    const pathParam = `-BuildToolsInstallerPath '${vccInstaller.directory}'`;

    const buildToolsParam = isBuildToolsInstalled
      ? ``
      : `-InstallBuildTools -ExtraBuildToolsParameters '${getBuildToolsExtraParameters()}'`;

    const pythonParam = isPythonInstalled
      ? ``
      : `-PythonInstaller '${pythonInstaller.fileName}' -InstallPython`;

    const psArgs = `& {& '${installerScriptPath}' ${pathParam} ${buildToolsParam} ${pythonParam} ${vccParam} }`;
    const args = ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-NoLogo', psArgs];

    debug(`Installer: Launching installer in ${vccInstaller.directory} with parameters ${args}.`);

    let child;

    try {
      child = spawn('powershell.exe', args);
    } catch (error) {
      log(chalk.bold.red('Error: failed while trying to run powershell.exe'));
      log('(Hint: Is "%SystemRoot%\\system32\\WindowsPowerShell\\v1.0" in your system path?)');
      return reject(error);
    }

    child.stdout.on('data', (data) => {
      debug(`Installer: Stdout from launch-installer.ps1: ${data.toString()}`);

      if (data.toString().includes('Please restart this script from an administrative PowerShell!')) {
        log(chalk.bold.red('Please restart this script from an administrative PowerShell!'));
        log('The build tools cannot be installed without administrative rights.');
        log('To fix, right-click on PowerShell and run "as Administrator".');

        // Bail out
        process.exit(1);
      }
    });

    child.stderr.on('data', (data) => debug(`Installer: Stderr from launch-installer.ps1: ${data.toString()}`));

    child.on('exit', () => resolve());
    child.stdin.end();
  });
}
