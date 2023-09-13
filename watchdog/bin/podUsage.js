const k8s = require('@kubernetes/client-node');

module.exports = async (names, namespaces) => {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);
    const group = 'metrics.k8s.io';
    const version = 'v1beta1';
    const namespace = namespaces; // Replace with your namespace
    const plural = 'pods';
    const name = names; // Replace with your pod name

    async function getPodMetrics() {
    try {
        const res = await k8sApi.getNamespacedCustomObject(group, version, namespace, plural, name);
        console.log(names, 'metrics:', res.body.containers[0].usage);
        return {cpu: res.body.containers[0].usage.cpu, memory: res.body.containers[0].usage.memory}
        // process.exit();
    } catch (err) {
        console.error('Error fetching metrics:', err);
        process.exit();
    }}
   return getPodMetrics();
  };