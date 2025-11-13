/**
 * Dagster Job Materializer - Node.js Module
 * 
 * This module provides functionality to materialize Dagster jobs with support for:
 * - Job execution with custom run configurations
 * - Partition-based job execution
 * - Asset selection and execution options
 */

const fetch = require('node-fetch');

class DagsterJobMaterializer {
  constructor(baseUrl = 'http://localhost:3000', workspaceName = 'default') {
    this.baseUrl = baseUrl;
    this.workspaceName = workspaceName;
    this.graphqlUrl = `${baseUrl}/graphql`;
  }

  /**
   * Execute a GraphQL query against the Dagster GraphQL API
   */
  async executeGraphQL(query, variables = {}) {
    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      if (!response.ok) {
        console.log(await response.text());
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      throw new Error(`Failed to execute GraphQL query: ${error.message}`);
    }
  }

  /**
   * Materialize a job with custom options
   */
  async materializeJob(jobName, options = {}) {
    const {
      runConfig = {},
      tags = {},
      description = '',
      assetSelection = null,
      executionPlan = null
    } = options;

    const mutation = `
      mutation LaunchPipelineExecution($executionParams: ExecutionParams!) {
        launchPipelineExecution(executionParams: $executionParams) {
          __typename
          ... on LaunchRunSuccess {
            run {
              runId
              status
              pipeline {
                name
              }
            }
          }
          ... on PipelineNotFoundError {
            message
          }
          ... on InvalidStepError {
            invalidStepKey
          }
          ... on PipelineConfigValidationInvalid {
            errors {
              message
              path
            }
          }
          ... on RunConfigValidationInvalid {
            errors {
              message
              path
            }
          }
        }
      }
    `;

    const variables = {
      executionParams: {
        selector: {
          repositoryLocationName: this.workspaceName,
          repositoryName: '__repository__',
          pipelineName: jobName
        },
        runConfigData: JSON.stringify(runConfig),
        tags: Object.entries(tags).map(([key, value]) => ({ key, value })),
        ...(description && { description }),
        ...(assetSelection && { assetSelection }),
        ...(executionPlan && { executionPlan })
      }
    };

    const result = await this.executeGraphQL(mutation, variables);
    console.log(result)
    if (result.launchPipelineExecution.__typename === 'LaunchRunSuccess') {
      return {
        success: true,
        runId: result.launchPipelineExecution.run.runId,
        status: result.launchPipelineExecution.run.status,
        pipeline: result.launchPipelineExecution.run.pipeline.name
      };
    } else {
      throw new Error(`Job launch failed: ${JSON.stringify(result.launchPipelineExecution)}`);
    }
  }

  /**
   * Materialize a job for a specific partition
   */
  async materializeJobPartition(jobName, partitionKey, options = {}) {
    const {
      runConfig = {},
      tags = {},
      description = `Materialization for partition: ${partitionKey}`
    } = options;

    // Add partition key to tags
    const partitionTags = {
      ...tags,
      'dagster/partition': partitionKey
    };

    const mutation = `
      mutation LaunchPartitionBackfill($backfillParams: LaunchBackfillParams!) {
        launchPartitionBackfill(backfillParams: $backfillParams) {
          __typename
          ... on LaunchBackfillSuccess {
            backfillId
            launchedRunIds
          }
          ... on PartitionSetNotFoundError {
            message
          }
          ... on InvalidStepError {
            invalidStepKey
          }
          ... on PipelineConfigValidationInvalid {
            errors {
              message
              path
            }
          }
        }
      }
    `;

    const variables = {
      backfillParams: {
        selector: {
          repositoryLocationName: this.workspaceName,
          repositoryName: '__repository__',
          pipelineName: jobName
        },
        partitionNames: [partitionKey],
        reexecutionSteps: null,
        fromFailure: false,
        tags: Object.entries(partitionTags).map(([key, value]) => ({ key, value })),
        ...(description && { description })
      }
    };

    const result = await this.executeGraphQL(mutation, variables);
    
    if (result.launchPartitionBackfill.__typename === 'LaunchBackfillSuccess') {
      return {
        success: true,
        backfillId: result.launchPartitionBackfill.backfillId,
        runIds: result.launchPartitionBackfill.launchedRunIds,
        partitionKey
      };
    } else {
      throw new Error(`Partition backfill failed: ${JSON.stringify(result.launchPartitionBackfill)}`);
    }
  }

  /**
   * Materialize multiple partitions in batch
   */
  async materializeJobPartitions(jobName, partitionKeys, options = {}) {
    const {
      runConfig = {},
      tags = {},
      description = `Batch materialization for ${partitionKeys.length} partitions`,
      batchSize = 5
    } = options;

    const results = [];
    
    // Process partitions in batches to avoid overwhelming the system
    for (let i = 0; i < partitionKeys.length; i += batchSize) {
      const batch = partitionKeys.slice(i, i + batchSize);
      
      const batchPromises = batch.map(partitionKey => 
        this.materializeJobPartition(jobName, partitionKey, {
          runConfig,
          tags: { ...tags, 'batch_index': Math.floor(i / batchSize).toString() },
          description: `${description} - Partition: ${partitionKey}`
        })
      );

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < partitionKeys.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success: true,
      totalPartitions: partitionKeys.length,
      results: results.map((result, index) => ({
        partitionKey: partitionKeys[index],
        status: result.status,
        ...(result.status === 'fulfilled' ? result.value : { error: result.reason.message })
      }))
    };
  }

  /**
   * Get the status of a run
   */
  async getRunStatus(runId) {
    const query = `
      query GetRunStatus($runId: ID!) {
        runOrError(runId: $runId) {
          __typename
          ... on Run {
            runId
            status
            stats {
              stepsSucceeded
              stepsFailed
              materializations
              expectations
            }
            stepStats {
              stepKey
              status
              materializations {
                assetKey {
                  path
                }
              }
            }
          }
          ... on RunNotFoundError {
            message
          }
        }
      }
    `;

    const variables = { runId };
    const result = await this.executeGraphQL(query, variables);
    
    if (result.runOrError.__typename === 'Run') {
      return {
        success: true,
        runId: result.runOrError.runId,
        status: result.runOrError.status,
        stats: result.runOrError.stats,
        stepStats: result.runOrError.stepStats
      };
    } else {
      throw new Error(`Run not found: ${runId}`);
    }
  }

  /**
   * Wait for a run to complete
   */
  async waitForRun(runId, timeoutMs = 300000, pollIntervalMs = 2000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getRunStatus(runId);
      
      if (['SUCCESS', 'FAILURE', 'CANCELED'].includes(status.status)) {
        return status;
      }
      
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }
    
    throw new Error(`Run ${runId} did not complete within ${timeoutMs}ms`);
  }

  /**
   * List available jobs in the workspace
   */
  async listJobs() {
    const query = `
      query ListJobs($repositorySelector: RepositorySelector!) {
        repositoryOrError(repositorySelector: $repositorySelector) {
          __typename
          ... on Repository {
            pipelines {
              name
              description
              isJob
              modes {
                name
              }
            }
          }
        }
      }
    `;

    const variables = {
      repositorySelector: {
        repositoryLocationName: this.workspaceName,
        repositoryName: '__repository__'
      }
    };

    const result = await this.executeGraphQL(query, variables);

    if (result.repositoryOrError.__typename === 'Repository') {
      return result.repositoryOrError.pipelines.filter(pipeline => pipeline.isJob);
    } else {
      throw new Error('Repository not found');
    }
  }

  /**
   * Get partition keys for a job
   */
  async getPartitionKeys(jobName) {
    const query = `
      query GetPartitionKeys($repositorySelector: RepositorySelector!, $pipelineName: String!) {
        partitionSetsOrError(repositorySelector: $repositorySelector, pipelineName: $pipelineName) {
          __typename
          ... on PartitionSets {
            results {
              name
              partitionsOrError {
                __typename
                ... on Partitions {
                  results {
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const variables = {
      repositorySelector: {
        repositoryLocationName: this.workspaceName,
        repositoryName: '__repository__'
      },
      pipelineName: jobName
    };

    const result = await this.executeGraphQL(query, variables);
    
    if (result.partitionSetsOrError.__typename === 'PartitionSets') {
      const partitionSets = result.partitionSetsOrError.results;
      if (partitionSets.length > 0) {
        const partitionSet = partitionSets[0];
        if (partitionSet.partitionsOrError.__typename === 'Partitions') {
          return partitionSet.partitionsOrError.results.map(p => p.name);
        }
      }
    }
    
    return [];
  }

  /**
   * Remove a dynamic partition from a job
   */
  async removePartition(jobName, partitionKey) {
    // Query partition sets for the job
    const partitionSetsQuery = `
      query GetPartitionSets($repositorySelector: RepositorySelector!, $pipelineName: String!) {
        partitionSetsOrError(repositorySelector: $repositorySelector, pipelineName: $pipelineName) {
          __typename
          ... on PartitionSets {
            results {
              name
              mode
            }
          }
        }
      }
    `;
    const variables = {
      repositorySelector: {
        repositoryLocationName: this.workspaceName,
        repositoryName: '__repository__'
      },
      pipelineName: jobName
    };
    const result = await this.executeGraphQL(partitionSetsQuery, variables);

    if (
      result.partitionSetsOrError.__typename !== 'PartitionSets' ||
      !result.partitionSetsOrError.results.length
    ) {
      throw new Error('No partition sets found for job');
    }

    // Use the first partition set's name as the dynamic partition definition name
    const dynamicPartitionsDefinitionName = result.partitionSetsOrError.results[0].name;

    // Now call the deleteDynamicPartition mutation
    const mutation = `
      mutation DeleteDynamicPartition($dynamicPartitionsDefinitionName: String!, $partitionKey: String!, $repositorySelector: RepositorySelector!) {
        deleteDynamicPartition(
          dynamicPartitionsDefinitionName: $dynamicPartitionsDefinitionName,
          partitionKey: $partitionKey,
          repositorySelector: $repositorySelector
        ) {
          __typename
          ... on DeleteDynamicPartitionSuccess {
            message
          }
          ... on DynamicPartitionsDefinitionNotFoundError {
            message
          }
          ... on PartitionNotFoundError {
            message
          }
          ... on UnauthorizedError {
            message
          }
        }
      }
    `;

    const mutationVars = {
      dynamicPartitionsDefinitionName,
      partitionKey,
      repositorySelector: {
        repositoryLocationName: this.workspaceName,
        repositoryName: '__repository__'
      }
    };

    const delResult = await this.executeGraphQL(mutation, mutationVars);

    if (delResult.deleteDynamicPartition.__typename === 'DeleteDynamicPartitionSuccess') {
      return { success: true, message: delResult.deleteDynamicPartition.message };
    } else {
      throw new Error(`Partition removal failed: ${JSON.stringify(delResult.deleteDynamicPartition)}`);
    }
  }
}

module.exports = DagsterJobMaterializer;
