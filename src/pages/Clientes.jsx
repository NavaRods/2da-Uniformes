import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listenClientes, crearCliente } from "../lib/clientes";

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState({ nombre: "", edad: "", telefono: "" });
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => listenClientes(setClientes), []);

  async function onSubmit(e) {
    e.preventDefault();
    if (!form.nombre.trim()) return;
    await crearCliente(form);
    setForm({ nombre: "", edad: "", telefono: "" });
  }

  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="page">
      <h1>Clientes</h1>

      <form onSubmit={onSubmit} className="card">
        <h2>Nuevo cliente</h2>
        <input
          placeholder="Nombre"
          value={form.nombre}
          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          required
        />
        <input
          placeholder="Edad"
          type="number"
          value={form.edad}
          onChange={(e) => setForm({ ...form, edad: e.target.value })}
        />
        <input
          placeholder="Teléfono (para WhatsApp)"
          value={form.telefono}
          onChange={(e) => setForm({ ...form, telefono: e.target.value })}
        />
        <button type="submit">Registrar cliente</button>
      </form>

      <input
        className="buscador"
        placeholder="Buscar cliente..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <ul className="lista">
        {filtrados.map((c) => (
          <li key={c.id}>
            <Link to={`/clientes/${c.id}`}>
              {c.nombre} {c.documentacionEntregada ? "📄✅" : ""}
            </Link>
          </li>
        ))}
        {filtrados.length === 0 && <p>Sin clientes todavía.</p>}
      </ul>
    </div>
  );
}
