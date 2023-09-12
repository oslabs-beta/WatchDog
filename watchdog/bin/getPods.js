const k8s = require('@kubernetes/client-node');

module.exports = () => {
    
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api); 

    k8sApi.listPodForAllNamespaces().then((res) => {
      console.log('Pods:'.cyan);
      res.body.items.forEach((pod) => {
          // console.log(`${pod.metadata.namespace}/${pod.metadata.name}`);
          console.log(`   ${pod.metadata.name}`);
      });
      process.exit();
  })
  .catch((err) => {
      console.error('Error:', err);
  }); 
  };