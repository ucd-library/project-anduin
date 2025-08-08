# Dagster Node.js Job Materializer

A Node.js module for materializing Dagster jobs with support for custom options and partition-based execution.

## Features

- ✅ **Simple Job Materialization**: Execute Dagster jobs with custom configurations
- ✅ **Partition Support**: Materialize jobs for specific partitions or batch process multiple partitions
- ✅ **Run Monitoring**: Track job execution status and wait for completion
- ✅ **Flexible Configuration**: Support for custom run configs, tags, and descriptions
- ✅ **Error Handling**: Comprehensive error handling and validation
- ✅ **GraphQL Integration**: Direct integration with Dagster's GraphQL API using node-fetch

## Installation

```bash
cd examples/005_nodejs_materialize
npm install
```

## Quick Start

```javascript
const DagsterJobMaterializer = require('./index');

// Initialize the materializer
const materializer = new DagsterJobMaterializer('http://localhost:3000', 'default');

// Simple job materialization
const result = await materializer.materializeJob('my_job', {
  description: 'Job run from Node.js',
  tags: {
    'source': 'nodejs-client',
    'environment': 'production'
  }
});

console.log('Job launched:', result.runId);
```

## Usage Examples

### 1. Basic Job Materialization

```javascript
const materializer = new DagsterJobMaterializer();

// Materialize a job with basic options
const result = await materializer.materializeJob('update_users_job', {
  description: 'Daily user data update',
  tags: {
    'schedule': 'daily',
    'priority': 'high'
  }
});

// Wait for completion
const finalStatus = await materializer.waitForRun(result.runId);
console.log('Job completed with status:', finalStatus.status);
```

### 2. Job with Custom Run Configuration

```javascript
// Materialize job with custom configuration
const result = await materializer.materializeJob('data_pipeline_job', {
  runConfig: {
    ops: {
      extract_data: {
        config: {
          database_url: 'postgresql://user:pass@host:5432/db',
          batch_size: 1000
        }
      },
      transform_data: {
        config: {
          transformation_rules: ['rule1', 'rule2']
        }
      }
    },
    resources: {
      database: {
        config: {
          connection_string: 'postgresql://user:pass@host:5432/db'
        }
      }
    }
  },
  tags: {
    'config_version': '1.2.0',
    'environment': 'production'
  }
});
```

### 3. Partition-Based Materialization

```javascript
// Get available partitions
const partitionKeys = await materializer.getPartitionKeys('partitioned_job');
console.log('Available partitions:', partitionKeys);

// Materialize single partition
const partitionResult = await materializer.materializeJobPartition(
  'partitioned_job',
  '2024-01-01',
  {
    tags: {
      'partition_type': 'daily',
      'backfill': 'false'
    }
  }
);

console.log('Partition job launched:', partitionResult);
```

### 4. Batch Partition Processing

```javascript
// Materialize multiple partitions in batches
const partitionKeys = ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04'];

const batchResult = await materializer.materializeJobPartitions(
  'daily_processing_job',
  partitionKeys,
  {
    batchSize: 2, // Process 2 partitions at a time
    tags: {
      'batch_processing': 'true',
      'date_range': '2024-01-01_to_2024-01-04'
    }
  }
);

// Check results
batchResult.results.forEach((result, index) => {
  console.log(`Partition ${result.partitionKey}: ${result.status}`);
  if (result.status === 'fulfilled') {
    console.log(`  Run IDs: ${result.runIds.join(', ')}`);
  }
});
```

### 5. Job Monitoring and Status Tracking

```javascript
// Launch job and monitor progress
const result = await materializer.materializeJob('long_running_job');

console.log('Monitoring job execution...');
let attempts = 0;
const maxAttempts = 30;

while (attempts < maxAttempts) {
  const status = await materializer.getRunStatus(result.runId);
  console.log(`Status: ${status.status}`);
  
  if (['SUCCESS', 'FAILURE', 'CANCELED'].includes(status.status)) {
    console.log('Final stats:', status.stats);
    if (status.status === 'FAILURE') {
      // Handle failure (send alert, retry, etc.)
      console.log('Job failed! Taking corrective action...');
    }
    break;
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  attempts++;
}
```

## API Reference

### Constructor

```javascript
new DagsterJobMaterializer(baseUrl, workspaceName)
```

- `baseUrl` (string): Dagster webserver URL (default: 'http://localhost:3000')
- `workspaceName` (string): Workspace name (default: 'default')

### Methods

#### `materializeJob(jobName, options)`

Materialize a job with custom options.

**Parameters:**
- `jobName` (string): Name of the job to materialize
- `options` (object): Job execution options
  - `runConfig` (object): Run configuration for the job
  - `tags` (object): Tags to apply to the run
  - `description` (string): Description for the run
  - `assetSelection` (array): Assets to materialize
  - `executionPlan` (object): Custom execution plan

**Returns:** Promise resolving to run information

#### `materializeJobPartition(jobName, partitionKey, options)`

Materialize a job for a specific partition.

**Parameters:**
- `jobName` (string): Name of the partitioned job
- `partitionKey` (string): Partition key to materialize
- `options` (object): Execution options (same as materializeJob)

**Returns:** Promise resolving to backfill information

#### `materializeJobPartitions(jobName, partitionKeys, options)`

Materialize multiple partitions in batches.

**Parameters:**
- `jobName` (string): Name of the partitioned job
- `partitionKeys` (array): Array of partition keys
- `options` (object): Execution options plus:
  - `batchSize` (number): Number of partitions to process simultaneously

**Returns:** Promise resolving to batch execution results

#### `getRunStatus(runId)`

Get the current status of a run.

**Parameters:**
- `runId` (string): ID of the run to check

**Returns:** Promise resolving to run status and statistics

#### `waitForRun(runId, timeoutMs, pollIntervalMs)`

Wait for a run to complete.

**Parameters:**
- `runId` (string): ID of the run to wait for
- `timeoutMs` (number): Maximum time to wait (default: 300000)
- `pollIntervalMs` (number): Polling interval (default: 2000)

**Returns:** Promise resolving to final run status

#### `listJobs()`

List all available jobs in the workspace.

**Returns:** Promise resolving to array of job information

#### `getPartitionKeys(jobName)`

Get available partition keys for a job.

**Parameters:**
- `jobName` (string): Name of the partitioned job

**Returns:** Promise resolving to array of partition keys

## Running Examples

```bash
# Run the example script
npm run example

# Run tests
npm test
```

## Integration with Existing Dagster Jobs

This module works with the existing Dagster jobs in the project:

- `update_users_job` (from `002_batched_asset`)
- `update_users_dynamic_job` (from `003_sensor_asset`)

Make sure your Dagster webserver is running and accessible at the specified URL.

## Error Handling

The module includes comprehensive error handling:

```javascript
try {
  const result = await materializer.materializeJob('my_job');
  console.log('Success:', result);
} catch (error) {
  if (error.message.includes('GraphQL Error')) {
    console.log('Dagster API error:', error.message);
  } else if (error.message.includes('Job launch failed')) {
    console.log('Job configuration error:', error.message);
  } else {
    console.log('Network or other error:', error.message);
  }
}
```

## Advanced Usage Patterns

See `example.js` for advanced patterns including:
- Conditional job execution based on external factors
- Job monitoring and alerting
- Dynamic partition management
- Batch processing with error recovery

## Contributing

1. Add new features to `index.js`
2. Update tests in `test.js`
3. Add examples to `example.js`
4. Update this README
