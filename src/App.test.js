import { render, screen } from '@testing-library/react';
import App from './App';

test('renders SIG TPI application', () => {
  render(<App />);
  // Verificar que el título de la aplicación se renderiza
  const titleElement = screen.getByText(/SIG – TPI/i);
  expect(titleElement).toBeInTheDocument();
});
