/**
 * Comprehensive Demo Script
 * 
 * This script demonstrates all the capabilities of the Dagster Job Materializer
 * with realistic use cases and error handling.
 */

const DagsterJobMaterializer = require('./index');

class DagsterDemo {
  constructor() {
    this.materializer = new DagsterJobMaterializer('http://localhost:3000', 'default');
    this.results = [];
  }

  async runDemo() {
    console.log('🎯 Dagster Node.js Materializer Comprehensive Demo');
    console.log('=' .repeat(60));
    console.log('');

    try {
      await this.checkConnection();
      await this.demonstrateBasicJob();
      await this.demonstrateConfigurableJob();
      await this.demonstratePartitionedJob();
      await this.demonstrateBatchPartitions();
      await this.demonstrateMonitoring();
      
      this.printSummary();
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
      console.error('Make sure Dagster is running on http://localhost:3000');
    }
  }

  async checkConnection() {
    console.log('🔗 Checking Dagster connection...');
    
    try {
      const jobs = await this.materializer.listJobs();
      console.log(`✅ Connected! Found ${jobs.length} jobs:`);
      jobs.forEach(job => {
        console.log(`   - ${job.name}: ${job.description || 'No description'}`);
      });
      console.log('');
      
      this.availableJobs = jobs.map(j => j.name);
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  async demonstrateBasicJob() {
    console.log('🚀 Demo 1: Basic Job Materialization');
    console.log('-'.repeat(40));
    
    // Try to use nodejs_demo_job if available, otherwise use the first available job
    const jobName = this.availableJobs.includes('nodejs_demo_job') 
      ? 'nodejs_demo_job' 
      : this.availableJobs[0];
    
    if (!jobName) {
      console.log('⚠️  No jobs available for demo');
      return;
    }

    const result = await this.materializer.materializeJob(jobName, {
      description: 'Basic job materialization from Node.js demo',
      tags: {
        'demo': 'basic',
        'source': 'nodejs-demo',
        'timestamp': new Date().toISOString()
      }
    });

    console.log(`✅ Job '${jobName}' launched successfully`);
    console.log(`   Run ID: ${result.runId}`);
    console.log(`   Status: ${result.status}`);
    
    this.results.push({
      type: 'basic',
      jobName,
      runId: result.runId,
      status: 'launched'
    });
    
    console.log('');
  }

  async demonstrateConfigurableJob() {
    console.log('⚙️  Demo 2: Job with Custom Configuration');
    console.log('-'.repeat(40));
    
    const jobName = this.availableJobs.includes('nodejs_configurable_job')
      ? 'nodejs_configurable_job'
      : this.availableJobs[0];

    const result = await this.materializer.materializeJob(jobName, {
      runConfig: {
        ops: {
          configurable_data: {
            config: {
              batch_size: 100,
              environment: 'demo',
              processing_mode: 'fast'
            }
          }
        }
      },
      tags: {
        'demo': 'configurable',
        'config_version': '2.0',
        'batch_size': '100'
      },
      description: 'Demonstrating custom run configuration'
    });

    console.log(`✅ Configurable job '${jobName}' launched`);
    console.log(`   Run ID: ${result.runId}`);
    console.log('   Configuration: batch_size=100, environment=demo');
    
    this.results.push({
      type: 'configurable',
      jobName,
      runId: result.runId,
      status: 'launched'
    });
    
    console.log('');
  }

  async demonstratePartitionedJob() {
    console.log('📅 Demo 3: Partitioned Job Materialization');
    console.log('-'.repeat(40));
    
    const jobName = this.availableJobs.includes('nodejs_partitioned_job')
      ? 'nodejs_partitioned_job'
      : null;

    if (!jobName) {
      console.log('⚠️  No partitioned jobs available, skipping partition demo');
      console.log('');
      return;
    }

    // Get available partitions
    const partitionKeys = await this.materializer.getPartitionKeys(jobName);
    console.log(`📋 Found ${partitionKeys.length} partitions for '${jobName}'`);
    
    if (partitionKeys.length === 0) {
      console.log('   Creating demo partition: 2024-01-01');
      // In a real scenario, you might create partitions dynamically
      // For demo purposes, we'll use a known date
      const demoPartition = '2024-01-01';
      
      const result = await this.materializer.materializeJobPartition(jobName, demoPartition, {
        tags: {
          'demo': 'partition',
          'partition_date': demoPartition,
          'created_by': 'nodejs_demo'
        },
        description: `Demo partition materialization for ${demoPartition}`
      });

      console.log(`✅ Partition '${demoPartition}' materialized`);
      console.log(`   Backfill ID: ${result.backfillId}`);
      console.log(`   Run IDs: ${result.runIds.join(', ')}`);
      
      this.results.push({
        type: 'partition',
        jobName,
        partitionKey: demoPartition,
        backfillId: result.backfillId,
        status: 'launched'
      });
    } else {
      // Use the first available partition
      const partitionKey = partitionKeys[0];
      
      const result = await this.materializer.materializeJobPartition(jobName, partitionKey, {
        tags: {
          'demo': 'partition',
          'partition_key': partitionKey
        }
      });

      console.log(`✅ Existing partition '${partitionKey}' materialized`);
      console.log(`   Backfill ID: ${result.backfillId}`);
    }
    
    console.log('');
  }

  async demonstrateBatchPartitions() {
    console.log('📦 Demo 4: Batch Partition Processing');
    console.log('-'.repeat(40));
    
    // Create some demo partitions
    const demoPartitions = ['2024-01-01', '2024-01-02', '2024-01-03'];
    const jobName = this.availableJobs.includes('nodejs_partitioned_job')
      ? 'nodejs_partitioned_job'
      : null;

    if (!jobName) {
      console.log('⚠️  No partitioned jobs available, skipping batch demo');
      console.log('');
      return;
    }

    console.log(`🔄 Processing ${demoPartitions.length} partitions in batches...`);
    
    const batchResult = await this.materializer.materializeJobPartitions(
      jobName,
      demoPartitions,
      {
        batchSize: 2,
        tags: {
          'demo': 'batch',
          'batch_processing': 'true',
          'total_partitions': demoPartitions.length.toString()
        },
        description: 'Batch processing demo partitions'
      }
    );

    console.log(`✅ Batch processing completed:`);
    console.log(`   Total partitions: ${batchResult.totalPartitions}`);
    console.log(`   Successful: ${batchResult.results.filter(r => r.status === 'fulfilled').length}`);
    console.log(`   Failed: ${batchResult.results.filter(r => r.status === 'rejected').length}`);
    
    batchResult.results.forEach((result, index) => {
      const status = result.status === 'fulfilled' ? '✅' : '❌';
      console.log(`   ${status} ${result.partitionKey}: ${result.status}`);
    });
    
    this.results.push({
      type: 'batch',
      jobName,
      partitions: demoPartitions,
      totalResults: batchResult.results.length,
      status: 'completed'
    });
    
    console.log('');
  }

  async demonstrateMonitoring() {
    console.log('📊 Demo 5: Job Monitoring and Status Tracking');
    console.log('-'.repeat(40));
    
    if (this.results.length === 0) {
      console.log('⚠️  No previous jobs to monitor');
      return;
    }

    // Monitor the first job we launched
    const firstJob = this.results.find(r => r.runId);
    if (!firstJob) {
      console.log('⚠️  No job runs to monitor');
      return;
    }

    console.log(`🔍 Monitoring run: ${firstJob.runId}`);
    
    try {
      // Check status a few times
      for (let i = 0; i < 3; i++) {
        const status = await this.materializer.getRunStatus(firstJob.runId);
        console.log(`   Check ${i + 1}: Status = ${status.status}`);
        
        if (status.stats) {
          console.log(`   Steps succeeded: ${status.stats.stepsSucceeded || 0}`);
          console.log(`   Steps failed: ${status.stats.stepsFailed || 0}`);
          console.log(`   Materializations: ${status.stats.materializations || 0}`);
        }
        
        if (['SUCCESS', 'FAILURE', 'CANCELED'].includes(status.status)) {
          console.log(`✅ Final status: ${status.status}`);
          break;
        }
        
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } catch (error) {
      console.log(`⚠️  Monitoring error: ${error.message}`);
    }
    
    console.log('');
  }

  printSummary() {
    console.log('📋 Demo Summary');
    console.log('=' .repeat(60));
    
    console.log(`✅ Total operations performed: ${this.results.length}`);
    
    const byType = this.results.reduce((acc, result) => {
      acc[result.type] = (acc[result.type] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
    
    console.log('');
    console.log('🎉 Demo completed successfully!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   - Check the Dagster UI at http://localhost:3000');
    console.log('   - Review the run logs and asset materializations');
    console.log('   - Modify the example code for your use case');
    console.log('   - Integrate into your Node.js applications');
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  const demo = new DagsterDemo();
  demo.runDemo().catch(console.error);
}

module.exports = DagsterDemo;
