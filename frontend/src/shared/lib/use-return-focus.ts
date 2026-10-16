import { useCallback, useRef } from 'react';

interface ReturnFocusHandlers {
  onOpenAutoFocus: (event: Event) => void;
  onCloseAutoFocus: (event: Event) => void;
}

/**
 * Devuelve el foco a quien abrió un diálogo al cerrarlo (WCAG 2.4.3).
 *
 * Radix lo hace solo con `DialogTrigger`, pero los diálogos del panel se abren con un
 * `<Button onClick>` que cambia un estado: sin trigger, Radix evita el foco por defecto y lo
 * deja en `<body>`. Al abrir, justo antes de que el foco entre al diálogo, todavía está en el
 * control que lo disparó: ese es el elemento que se recuerda (el componente puede renderizarse
 * cerrado desde antes, así que no sirve leerlo al montar). Si ya no existe —la fila se
 * borró—, el foco queda donde lo deje el navegador.
 *
 * Uso: pasar los dos handlers al contenido del diálogo.
 */
export function useReturnFocus(): ReturnFocusHandlers {
  const opener = useRef<Element | null>(null);

  const onOpenAutoFocus = useCallback(() => {
    opener.current = document.activeElement;
  }, []);

  const onCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    const target = opener.current;
    opener.current = null;
    if (target instanceof HTMLElement && target !== document.body && target.isConnected) {
      target.focus({ preventScroll: true });
    }
  }, []);

  return { onOpenAutoFocus, onCloseAutoFocus };
}
