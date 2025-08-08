/**
 * Example usage of the Dagster Job Materializer
 * 
 * This example demonstrates how to:
 * 1. Materialize a simple job
 * 2. Materialize a job with custom options
 * 3. Materialize a job for specific partitions
 * 4. Batch materialize multiple partitions
 */

const DagsterJobMaterializer = require('./index');

async function runExamples() {
  // Initialize the materializer
  const materializer = new DagsterJobMaterializer('http://localhost:3000', 'defs.py');
  
  console.log('🚀 Starting Dagster Job Materialization Examples\n');

  try {
    // Example 1: List available jobs
    console.log('📋 Listing available jobs...');
    const jobs = await materializer.listJobs();
    console.log('Available jobs:', jobs.map(j => j.name));
    console.log('');

    // Example 2: Simple job materialization
    console.log('🔥 Example 1: Simple job materialization');
    const simpleResult = await materializer.materializeJob('update_users_job', {
      description: 'Simple job run from Node.js',
      tags: {
        'source': 'nodejs-example',
        'environment': 'development'
      }
    });
    
    console.log('✅ Job launched:', simpleResult);
    
    // Wait for completion
    console.log('⏳ Waiting for job to complete...');
    const finalStatus = await materializer.waitForRun(simpleResult.runId, 120000); // 2 minute timeout
    console.log('🏁 Job completed:', finalStatus.status);
    console.log('');

    // Example 3: Job with custom run configuration
    console.log('🔥 Example 2: Job with custom run configuration');
    const configuredResult = await materializer.materializeJob('update_users_job', {
      runConfig: {
        ops: {
          get_users: {
            config: {
              database_url: 'postgresql://postgres@pg:5432/postgres'
            }
          }
        }
      },
      tags: {
        'source': 'nodejs-example',
        'config_type': 'custom',
        'environment': 'development'
      },
      description: 'Job with custom configuration from Node.js'
    });
    
    console.log('✅ Configured job launched:', configuredResult);
    console.log('');

    // Example 4: Partition-based materialization
    console.log('🔥 Example 3: Partition-based materialization');
    
    // First, get available partition keys
    const partitionKeys = await materializer.getPartitionKeys('update_users_dynamic_job');
    console.log('Available partition keys:', partitionKeys);
    
    if (partitionKeys.length > 0) {
      // Materialize first partition
      const partitionResult = await materializer.materializeJobPartition(
        'update_users_dynamic_job', 
        partitionKeys[0],
        {
          tags: {
            'source': 'nodejs-example',
            'execution_type': 'single_partition'
          }
        }
      );
      
      console.log('✅ Partition job launched:', partitionResult);
      console.log('');

      // Example 5: Batch partition materialization
      if (partitionKeys.length > 1) {
        console.log('🔥 Example 4: Batch partition materialization');
        
        const batchKeys = partitionKeys.slice(0, Math.min(3, partitionKeys.length)); // Take first 3 partitions
        const batchResult = await materializer.materializeJobPartitions(
          'update_users_dynamic_job',
          batchKeys,
          {
            batchSize: 2,
            tags: {
              'source': 'nodejs-example',
              'execution_type': 'batch_partitions'
            }
          }
        );
        
        console.log('✅ Batch materialization results:');
        batchResult.results.forEach((result, index) => {
          console.log(`  Partition ${result.partitionKey}: ${result.status}`);
          if (result.status === 'fulfilled') {
            console.log(`    Run IDs: ${result.runIds?.join(', ') || result.runId}`);
          } else {
            console.log(`    Error: ${result.error}`);
          }
        });
      }
    } else {
      console.log('⚠️  No partitions found for update_users_dynamic_job');
    }

    console.log('\n🎉 All examples completed successfully!');

  } catch (error) {
    console.error('❌ Error running examples:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Example of advanced usage patterns
async function advancedExamples() {
  const materializer = new DagsterJobMaterializer('http://localhost:3000', 'default');
  
  console.log('\n🔬 Advanced Usage Patterns\n');

  try {
    // Pattern 1: Conditional materialization based on data freshness
    console.log('🔥 Pattern 1: Conditional materialization');
    
    const jobs = await materializer.listJobs();
    for (const job of jobs.slice(0, 1)) { // Just check first job
      console.log(`Checking job: ${job.name}`);
      
      // You could add logic here to check data freshness, external conditions, etc.
      const shouldRun = true; // Replace with your condition logic
      
      if (shouldRun) {
        const result = await materializer.materializeJob(job.name, {
          tags: {
            'trigger': 'conditional',
            'timestamp': new Date().toISOString()
          }
        });
        console.log(`✅ Conditionally triggered ${job.name}: ${result.runId}`);
      }
    }

    // Pattern 2: Monitoring and alerting
    console.log('\n🔥 Pattern 2: Job monitoring');
    
    const monitoringResult = await materializer.materializeJob('update_users_job', {
      tags: { 'monitoring': 'enabled' }
    });
    
    console.log('📊 Monitoring job execution...');
    let attempts = 0;
    const maxAttempts = 30; // 1 minute with 2-second intervals
    
    while (attempts < maxAttempts) {
      const status = await materializer.getRunStatus(monitoringResult.runId);
      console.log(`  Status check ${attempts + 1}: ${status.status}`);
      
      if (['SUCCESS', 'FAILURE', 'CANCELED'].includes(status.status)) {
        console.log('📈 Final stats:', status.stats);
        
        if (status.status === 'FAILURE') {
          console.log('🚨 Job failed! You could send an alert here.');
        } else if (status.status === 'SUCCESS') {
          console.log('✅ Job succeeded! Materializations:', status.stats.materializations);
        }
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    // Pattern 3: Dynamic partition management
    console.log('\n🔥 Pattern 3: Dynamic partition management');
    
    const dynamicPartitions = ['user_001', 'user_002', 'user_003'];
    console.log('Creating dynamic partitions:', dynamicPartitions);
    
    // In a real scenario, you might want to add these partitions to Dagster first
    // This would typically be done through the sensor or by calling Dagster's partition management APIs
    
    const dynamicResult = await materializer.materializeJobPartitions(
      'update_users_dynamic_job',
      dynamicPartitions,
      {
        batchSize: 1,
        tags: {
          'dynamic': 'true',
          'created_by': 'nodejs_client'
        }
      }
    );
    
    console.log('✅ Dynamic partition execution completed');
    console.log(`   Total partitions: ${dynamicResult.totalPartitions}`);
    console.log(`   Successful: ${dynamicResult.results.filter(r => r.status === 'fulfilled').length}`);
    console.log(`   Failed: ${dynamicResult.results.filter(r => r.status === 'rejected').length}`);

  } catch (error) {
    console.error('❌ Error in advanced examples:', error.message);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    await runExamples();
    await advancedExamples();
  })();
}

module.exports = {
  runExamples,
  advancedExamples
};
