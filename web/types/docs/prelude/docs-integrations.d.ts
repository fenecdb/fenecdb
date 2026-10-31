// What the examples on integrations.html take from the app around them.

/** The app's own components. */
declare function Spinner(): import('react').ReactNode;
declare function Task(props: {
  task: import('@fennecdb/web').Row<import('../fennec-schema.js').FennecSchema['tasks']>;
}): import('react').ReactNode;
