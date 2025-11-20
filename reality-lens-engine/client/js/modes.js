// Phase 5 modes (minimal)
export const Modes = {
  list: ["architect", "debug", "clarity"],
  is(m) {
    return m === window.App?.state?.mode;
  },
};
