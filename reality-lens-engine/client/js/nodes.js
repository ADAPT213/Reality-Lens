// Track placed nodes
export const Nodes = (function () {
  const items = [];
  return {
    add(obj) {
      items.push(obj);
    },
    count() {
      return items.length;
    },
  };
})();
