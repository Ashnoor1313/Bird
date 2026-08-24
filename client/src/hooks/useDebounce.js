import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce values (e.g. search query inputs)
 * to avoid making API calls on every keystroke.
 */
export function useDebounce(value, delay = 250) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
