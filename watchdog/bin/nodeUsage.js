const k8s = require('@kubernetes/client-node');

module.exports = async () => {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    try {
      const topNodesRes = await k8s.topNodes(k8sApi);
      // const topPodsRes = await k8s.topPods(k8sApi);
      // console.log('TOP PODS ______________: ', topPodsRes)
      // console.log('topNodesRes: ', topNodesRes[0].Node.metadata.name)
      const CPUPercentage = () => {
        return (
          Math.floor(
            (100 * Number(topNodesRes[0].CPU.RequestTotal)) /
              Number(topNodesRes[0].CPU.Capacity)
          ).toString() + '%'
        );
      };
      const memoryPercentage = () => {
        return (
          Math.floor(
            (100 * Number(topNodesRes[0].Memory.RequestTotal)) /
              Number(topNodesRes[0].Memory.Capacity)
          ).toString() + '%'
        );
      };
      const CPU = CPUPercentage();
      const memory = memoryPercentage();
      console.log(`CPU: ${CPU} Memory: ${memory}`.cyan);
      process.exit();
    } catch (err) {
      console.error(err);
    }
  };