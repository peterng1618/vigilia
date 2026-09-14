/**
 * What every editor manager is.
 *
 * One class per domain, constructed uniformly as `new XManager({ editor })`,
 * torn down by `destroy()`. The composition root
 * ({@link ../core/editor.js | EditorCore}) holds one of each and nothing else
 * constructs them, which is what makes "who owns this concern" answerable by
 * looking at a folder name.
 *
 * The interface is deliberately one method. A manager's *useful* surface is
 * specific to its domain and lives on the class; what the root needs to know
 * about all of them uniformly is only how to take them apart again, in the
 * reverse of the order they were built.
 */
export interface EditorManager {
  /**
   * Releases whatever the manager acquired — listeners, timers, DOM.
   *
   * Must tolerate being called on a manager that never finished constructing:
   * a failure partway through `EditorCore.init()` tears down what was built so
   * far, and a half-built manager is exactly the one that threw.
   */
  destroy(): void;
}
