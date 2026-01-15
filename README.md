[![GitHub release](https://img.shields.io/github/release/step-security/ghaction-github-status.svg?style=flat-square)](https://github.com/step-security/ghaction-github-status/releases/latest)
[![Test workflow](https://img.shields.io/github/actions/workflow/status/step-security/ghaction-github-status/test.yml?branch=master&label=test&logo=github&style=flat-square)](https://github.com/step-security/ghaction-github-status/actions?workflow=test)

## About

A GitHub Action to check [GitHub Status](https://www.githubstatus.com/) in your workflow.

___

* [Features](#features)
* [Usage](#usage)
  * [Basic workflow](#basic-workflow)
  * [Trigger error if GitHub services are down](#trigger-error-if-github-services-are-down)
* [Customizing](#customizing)
  * [inputs](#inputs)
* [License](#license)

## Features

* Threshold management for each GitHub service or global (rollup)
* Display status of all services
* Display active incidents and updates

## Usage

### Basic workflow

The following workflow is purely informative and will only display the current
status of GitHub services:

![GitHub Status - OK](.github/ghaction-github-status2.png)

```yaml
name: build

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      -
        name: Check GitHub Status
        uses: step-security/ghaction-github-status@v4
      -
        name: Checkout
        uses: actions/checkout@v6
```

### Trigger error if GitHub services are down

In the example below, we will set some status thresholds so that the job can
fail if these thresholds are exceeded.

This can be useful if you have an action that publishes to GitHub Pages, but
the service is down.

![GitHub Status - Failed](.github/ghaction-github-status.png)

```yaml
name: build

on: push

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      -
        name: Check GitHub Status
        uses: step-security/ghaction-github-status@v4
        with:
          overall_threshold: minor
          pages_threshold: partial_outage
      -
        name: Checkout
        uses: actions/checkout@v6
```

## Customizing

### inputs

Following inputs can be used as `step.with` keys

| Name                        | Type   | Description                                                                         |
|-----------------------------|--------|-------------------------------------------------------------------------------------|
| `overall_threshold`**¹**    | String | Defines threshold for overall status (also called rollup) of GitHub to fail the job |
| `git_threshold`**²**        | String | Defines threshold for Git Operations to fail the job                                |
| `api_threshold`**²**        | String | Defines threshold for API Requests to fail the job                                  |
| `webhooks_threshold`**²**   | String | Defines threshold for Webhooks to fail the job                                      |
| `issues_threshold`**²**     | String | Defines threshold for Issues to fail the job                                        |
| `prs_threshold`**²**        | String | Defines threshold for Pull Requests to fail the job                                 |
| `actions_threshold`**²**    | String | Defines threshold for Actions to fail the job                                       |
| `packages_threshold`**²**   | String | Defines threshold for Packages to fail the job                                      |
| `pages_threshold`**²**      | String | Defines threshold for Pages to fail the job                                         |
| `codespaces_threshold`**²** | String | Defines threshold for Codespaces to fail the job                                    |
| `copilot_threshold`**²**    | String | Defines threshold for Copilot to fail the job                                       |

> * **¹** Accepted values are `minor`, `major`, `critical` or `maintenance`.
> * **²** Accepted values are `operational`, `degraded_performance`, `partial_outage` `major_outage`, `under_maintenance`.


## License

MIT. See `LICENSE` for more details.
