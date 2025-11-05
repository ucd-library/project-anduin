const DagsterJobMaterializer = require('./index');

const materializer = new DagsterJobMaterializer();

(async function() {
  let resp = await materializer.materializeJobPartition('etl_users_job', 'jrmerz@ucdavis.edu');
  console.log(resp);
})();