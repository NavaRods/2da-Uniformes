import SelectorBuscable from "./SelectorBuscable";

// Envoltorio de SelectorBuscable para elegir un elemento por nombre.
export default function BuscadorElemento({
  elementos,
  onSeleccionar,
  placeholder = "Selecciona un elemento...",
}) {
  return (
    <SelectorBuscable
      items={elementos}
      onSeleccionar={onSeleccionar}
      obtenerTexto={(el) => el.nombre}
      placeholder={placeholder}
      placeholderBusqueda="Buscar por nombre..."
    />
  );
}
