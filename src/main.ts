process.env.FORCE_COLOR = '2';

import * as fs from 'fs';
import chalk from 'chalk';
import * as core from '@actions/core';

import * as githubstatus from './githubstatus.js';
import {Component, ComponentsStatusName, ComponentStatus, getComponentStatusName, getOverallStatusName, OverallStatus, OverallStatusName} from './githubstatus.js';
import {Summary} from './summary.js';
import * as utilm from './util.js';
import axios, {isAxiosError} from 'axios';

const unhealthy: Array<string> = [];

async function validateSubscription(): Promise<void> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  let repoPrivate: boolean | undefined;

  if (eventPath && fs.existsSync(eventPath)) {
    const eventData = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
    repoPrivate = eventData?.repository?.private;
  }

  const upstream = 'crazy-max/ghaction-github-status';
  const action = process.env.GITHUB_ACTION_REPOSITORY;
  const docsUrl = 'https://docs.stepsecurity.io/actions/stepsecurity-maintained-actions';

  core.info('');
  core.info('\u001b[1;36mStepSecurity Maintained Action\u001b[0m');
  core.info(`Secure drop-in replacement for ${upstream}`);
  if (repoPrivate === false) core.info('\u001b[32m\u2713 Free for public repositories\u001b[0m');
  core.info(`\u001b[36mLearn more:\u001b[0m ${docsUrl}`);
  core.info('');

  if (repoPrivate === false) return;

  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const body: Record<string, string> = {action: action || ''};
  if (serverUrl !== 'https://github.com') body.ghes_server = serverUrl;
  try {
    await axios.post(`https://agent.api.stepsecurity.io/v1/github/${process.env.GITHUB_REPOSITORY}/actions/maintained-actions-subscription`, body, {timeout: 3000});
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 403) {
      core.error(`\u001b[1;31mThis action requires a StepSecurity subscription for private repositories.\u001b[0m`);
      core.error(`\u001b[31mLearn how to enable a subscription: ${docsUrl}\u001b[0m`);
      process.exit(1);
    }
    core.info('Timeout or API not reachable. Continuing to next step.');
  }
}

async function run() {
  try {
    await validateSubscription();
    const summary: Summary | null = await githubstatus.summary();
    if (summary == null) {
      core.setFailed(`Unable to contact GitHub Status API at this time.`);
      return;
    }

    const overallThreshold: OverallStatus | undefined = await getOverallStatus('overall_threshold');
    const componentsthreshold = new Map<Component, ComponentStatus | undefined>([
      [Component.Git, await getComponentStatus('git_threshold')],
      [Component.Api, await getComponentStatus('api_threshold')],
      [Component.Webhooks, await getComponentStatus('webhooks_threshold')],
      [Component.Issues, await getComponentStatus('issues_threshold')],
      [Component.PullRequests, await getComponentStatus('prs_threshold')],
      [Component.Actions, await getComponentStatus('actions_threshold')],
      [Component.Packages, await getComponentStatus('packages_threshold')],
      [Component.Pages, await getComponentStatus('pages_threshold')],
      [Component.Codespaces, await getComponentStatus('codespaces_threshold')],
      [Component.Copilot, await getComponentStatus('copilot_threshold')]
    ]);

    // Global
    const overallStatus = OverallStatusName.get(summary.status.indicator);
    if (overallStatus !== undefined && overallThreshold !== undefined && overallStatus >= overallThreshold) {
      unhealthy.push(`Overall (${await getOverallStatusName(overallStatus)} >= ${await getOverallStatusName(overallThreshold)})`);
    }
    switch (summary.status.indicator) {
      case 'minor': {
        core.warning(`GitHub Status: ${summary.status.description}`);
        break;
      }
      case 'major': {
        core.error(`GitHub Status: ${summary.status.description}`);
        break;
      }
      case 'critical': {
        core.error(`GitHub Status: ${summary.status.description}`);
        break;
      }
      case 'maintenance': {
        core.warning(`GitHub Status: ${summary.status.description}`);
        break;
      }
      default: {
        core.info(`GitHub Status: ${summary.status.description}`);
        break;
      }
    }

    // Components
    if (summary.components != undefined && summary.components?.length > 0) {
      core.info(`\n• ${chalk.bold(`Components status`)}`);
      await utilm.asyncForEach(summary.components, async component => {
        if (component.name.startsWith('Visit ')) {
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(<any>Object).values(Component).includes(component.name)) {
          core.info(chalk.cyan(`• ${component.name} is not implemented.`));
        }
        const compStatus = ComponentsStatusName.get(component.status);
        if (compStatus === undefined) {
          core.warning(`Cannot resolve status ${component.status} for ${component.name}`);
          return;
        }
        const compthreshold = componentsthreshold.get(component.name);
        if (compthreshold !== undefined && compStatus >= compthreshold) {
          unhealthy.push(`${component.name} (${await getComponentStatusName(compStatus)} >= ${await getComponentStatusName(compthreshold)})`);
        }
        let compStatusText;
        switch (component.status) {
          case 'operational': {
            compStatusText = chalk.green('Operational');
            break;
          }
          case 'degraded_performance': {
            compStatusText = chalk.magenta('Degraded performance');
            break;
          }
          case 'partial_outage': {
            compStatusText = chalk.yellow('Partial outage');
            break;
          }
          case 'major_outage': {
            compStatusText = chalk.red('Major outage');
            break;
          }
          case 'under_maintenance': {
            compStatusText = chalk.blue('Under maintenance');
            break;
          }
        }
        core.info(`  • ${compStatusText}${new Array(30 - compStatusText.length).join(' ')} ${component.name}`);
      });

      // Incidents
      if (summary.incidents != undefined && summary.incidents?.length > 0) {
        await utilm.asyncForEach(summary.incidents, async incident => {
          let inccol;
          switch (incident.impact) {
            case 'minor': {
              inccol = chalk.magenta;
              break;
            }
            case 'major': {
              inccol = chalk.yellow;
              break;
            }
            case 'critical': {
              inccol = chalk.red;
              break;
            }
            default: {
              inccol = chalk.white;
              break;
            }
          }
          core.info(`\n• ${inccol.bold(`${incident.name} (${incident.shortlink})`)}`);

          // Incident updates
          await utilm.asyncForEach(incident.incident_updates, async update => {
            const incdate = new Date(update.updated_at).toLocaleDateString('en-US', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            });
            core.info(`  • ${chalk.gray(incdate)} - ${update.body}`);
          });
        });

        // Check unhealthy
        if (unhealthy.length > 0) {
          core.info(`\n• ${chalk.bgRed(`Unhealthy`)}`);
          await utilm.asyncForEach(unhealthy, async text => {
            core.info(`  • ${text}`);
          });
          core.setFailed(`GitHub is unhealthy. Following your criteria, the job has been marked as failed.`);
          return;
        }
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

async function getOverallStatus(input: string): Promise<OverallStatus | undefined> {
  const value = core.getInput(input);
  const status = OverallStatusName.get(value);
  if (value != '' && status === undefined) {
    throw new Error(`Overall status ${value} does not exist`);
  }
  return status;
}

async function getComponentStatus(input: string): Promise<ComponentStatus | undefined> {
  const value = core.getInput(input);
  const status = ComponentsStatusName.get(value);
  if (value != '' && status === undefined) {
    throw new Error(`Component status ${value} does not exist for ${input}`);
  }
  return status;
}

run();
