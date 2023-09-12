const k8s = require('@kubernetes/client-node');

module.exports = () => {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api); 
    k8sApi.listNode().then((res) => {
      console.log('Nodes:'.cyan);
      res.body.items.forEach((node) => {
          console.log(`   ${node.metadata.name}`);
      });
      process.exit();
  })
  .catch((err) => {
      console.error('Error:', err);
  });
  };