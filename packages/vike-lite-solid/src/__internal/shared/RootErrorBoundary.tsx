import { ErrorBoundary, type ParentComponent } from 'solid-js'

export const RootErrorBoundary: ParentComponent = (props) => {
  return (
    <ErrorBoundary fallback={(err: Error) => (
      <div style={{ 'font-family': 'sans-serif', padding: '2rem', 'text-align': 'center' }}>
        {import.meta.env.DEV ? (
          <div style={{ 'text-align': 'left', background: '#fee2e2', padding: '1rem', 'border-radius': '4px' }}>
            <h2 style={{ color: '#991b1b', 'margin-top': 0 }}><strong>{err.name}:</strong> {err.message}</h2>
            <pre style={{ background: '#222', color: '#fff', padding: '1rem', 'overflow-x': 'auto', 'margin-top': '1rem' }}>
              {err.stack}
            </pre>
          </div>
        ) : (
          <>
            <h1>500 | Internal Error</h1>
            <p>An unexpected error occurred. Please try again later.</p>
          </>
        )}
      </div>
    )}>
      {props.children}
    </ErrorBoundary>
  )
}
