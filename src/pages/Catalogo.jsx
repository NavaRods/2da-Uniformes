import { useEffect, useState } from "react";
import {
  listenCatalogo,
  sembrarCatalogoInicial,
  crearProducto,
  editarProducto,
  agregarTalla,
  TALLA_TIPO,
} from "../lib/catalogo";

export default function Catalogo() {
  const [productos, setProductos] = useState([]);
  const [nuevaTalla, setNuevaTalla] = useState({});
  const [form, setForm] = useState({
    nombre: "",
    grupo: "Varonil",
    precio: "",
    tallaTipo: TALLA_TIPO.NINGUNA,
  });

  useEffect(() => listenCatalogo(setProductos), []);

  async function onSembrar() {
    const hecho = await sembrarCatalogoInicial();
    if (!hecho) alert("El catálogo ya tiene productos, no se volvió a cargar.");
  }

  async function onCrear(e) {
    e.preventDefault();
    if (!form.nombre || !form.precio) return;
    await crearProducto({ ...form, tallas: [] });
    setForm({ nombre: "", grupo: "Varonil", precio: "", tallaTipo: TALLA_TIPO.NINGUNA });
  }

  async function onAgregarTalla(productoId) {
    const talla = nuevaTalla[productoId];
    if (!talla) return;
    await agregarTalla(productoId, talla);
    setNuevaTalla({ ...nuevaTalla, [productoId]: "" });
  }

  const grupos = ["Varonil", "Femenino", "Ambos"];

  return (
    <div className="page">
      <h1>Catálogo</h1>

      {productos.length === 0 && (
        <button onClick={onSembrar}>Cargar catálogo inicial</button>
      )}

      <form onSubmit={onCrear} className="card">
        <h2>Agregar producto</h2>
        <input
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
        />
        <select
          value={form.grupo}
          onChange={(e) => setForm({ ...form, grupo: e.target.value })}
        >
          {grupos.map((g) => (
            <option key={g}>{g}</option>
          ))}
        </select>
        <input
          placeholder="Precio"
          type="number"
          value={form.precio}
          onChange={(e) => setForm({ ...form, precio: e.target.value })}
        />
        <select
          value={form.tallaTipo}
          onChange={(e) => setForm({ ...form, tallaTipo: e.target.value })}
        >
          <option value={TALLA_TIPO.NINGUNA}>Sin talla</option>
          <option value={TALLA_TIPO.LISTA}>Talla de lista (editable)</option>
          <option value={TALLA_TIPO.LIBRE}>Talla libre (a la medida)</option>
        </select>
        <button type="submit">Agregar</button>
      </form>

      {grupos.map((grupo) => (
        <div key={grupo}>
          <h2>{grupo}</h2>
          {productos
            .filter((p) => p.grupo === grupo)
            .map((p) => (
              <div key={p.id} className="card">
                <strong>
                  {p.nombre} — ${p.precio}
                </strong>
                {p.colores?.length > 0 && (
                  <p>Colores: {p.colores.join(", ")}</p>
                )}
                {p.tallaTipo === TALLA_TIPO.LISTA && (
                  <>
                    <p>Tallas: {p.tallas.join(", ") || "—"}</p>
                    <div className="inline-form">
                      <input
                        placeholder="Nueva talla"
                        value={nuevaTalla[p.id] || ""}
                        onChange={(e) =>
                          setNuevaTalla({ ...nuevaTalla, [p.id]: e.target.value })
                        }
                      />
                      <button onClick={() => onAgregarTalla(p.id)}>
                        Agregar talla
                      </button>
                    </div>
                  </>
                )}
                {p.tallaTipo === TALLA_TIPO.LIBRE && (
                  <p>Talla: se define a la medida al vender.</p>
                )}
                <div className="inline-form">
                  <input
                    placeholder="Editar precio"
                    type="number"
                    defaultValue={p.precio}
                    onBlur={(e) =>
                      e.target.value !== String(p.precio) &&
                      editarProducto(p.id, { precio: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
