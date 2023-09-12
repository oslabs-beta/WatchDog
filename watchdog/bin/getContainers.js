const k8s = require('@kubernetes/client-node');

module.exports = () => {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api); 
    //queries for every pod, then pulls each container out of the pod and lists each individually...this will probably have to move to a sql database
    k8sApi.listPodForAllNamespaces().then((res) => {
      console.log('Containers:'.cyan);
      
      res.body.items.forEach((pod) => {
          // each of these pods can/will have multiple containers so we have to iterate through it again
          const containers = pod.spec.containers;
          containers.forEach((container) => {
              // console.log(`Namespace: ${pod.metadata.namespace}, Pod: ${pod.metadata.name}, Container: ${container.name}`);
              console.log(`   ${container.name}`);
          });
      });
      process.exit();
  })
  .catch((err) => {
      console.error('Error:', err);
  });
  };