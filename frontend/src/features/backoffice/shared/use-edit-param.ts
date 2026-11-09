import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';

/** Parámetro de la URL con el id del ítem a abrir (enlace «Abrir» de la pantalla Revisión). */
export const EDIT_PARAM = 'editar';

export const MISSING_ITEM_MESSAGE = 'El ítem ya no existe.';

interface EditParamOptions<T> {
  /** `true` cuando terminaron de cargar todas las listas donde `find` busca. */
  ready: boolean;
  find: (id: string) => T | undefined;
  /** Abre el diálogo de edición del ítem encontrado. */
  onFound: (item: T) => void;
  /**
   * Si el id no está, avisa «El ítem ya no existe.» y saca el parámetro. Una sección que solo ve
   * una parte de la pantalla (Formación y Proyectos tienen dos listas) lo desactiva y deja que lo
   * haga el hook de la página, que sí ve todas.
   */
  reportMissing?: boolean;
}

/**
 * `?editar=<id>` (D12 de `add-cv-consistency-rules`): cuando la lista terminó de cargar, busca el
 * id entre sus ítems, abre el diálogo de edición y saca el parámetro de la URL con `replace`
 * (así Volver no lo reabre). Si no lo encuentra avisa y no abre nada.
 */
export function useEditParam<T>({
  ready,
  find,
  onFound,
  reportMissing = true,
}: EditParamOptions<T>): void {
  const [params, setParams] = useSearchParams();
  const id = params.get(EDIT_PARAM);
  // Un solo manejo por id, aunque el efecto corra dos veces (StrictMode) o cambien las funciones.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (id === null) {
      handled.current = null;
      return;
    }
    if (!ready || handled.current === id) return;
    const item = find(id);
    if (item === undefined && !reportMissing) return;
    handled.current = id;
    if (item !== undefined) onFound(item);
    else toast.error(MISSING_ITEM_MESSAGE);
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete(EDIT_PARAM);
        return next;
      },
      { replace: true },
    );
    // `find` y `onFound` cambian en cada render; el id y la carga son los que disparan el efecto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready]);
}
