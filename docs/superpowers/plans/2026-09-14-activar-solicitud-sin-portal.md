# Activar solicitudes sin cuenta de portal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Confirmar pago y activar" (`activarSolicitud`) funciona también para
solicitudes que llegaron por WhatsApp o llamada — hoy falla siempre para
ellas porque busca un perfil de portal que nunca tienen. Esto es lo único
que bloquea, en la práctica, la automatización de `negocio.estado = cliente`
que la Fase 4 de la rama `feat/zak-automatizacion-estados` ya construyó.

**Architecture:** `activarSolicitud` resuelve el "cliente de la cartera" con
tres caminos en vez de uno: (a) con cuenta de portal, igual que hoy — desde
el perfil; (b) sin cuenta, en un reintento tras un fallo parcial — el
cliente ya existe, se recupera vía el producto ya referenciado (mismo
mecanismo de idempotencia que ya protege el resto de la función); (c) sin
cuenta, la primera vez — se crea el cliente directo desde los datos de
contacto de la solicitud (`contacto_nombre`/`contacto_telefono`/
`contacto_email`), vinculado al negocio de origen si lo tiene
(`clientes.negocio_id`). **Ninguno de estos tres caminos cambia CUÁNDO se
crea el cliente ni cuándo el negocio pasa a `estado = "cliente"`**: eso sigue
disparando únicamente cuando el admin confirma el diálogo "¿Confirmas que el
pago llegó?" y las cuatro escrituras de `activarSolicitud` terminan bien —
exactamente como hoy. Lo único que cambia es que ese botón deja de fallar
antes de siquiera intentarlo quand la solicitud no tiene cuenta de portal.
Darle acceso al portal a este cliente después sigue siendo, a propósito, un
paso aparte que esta pantalla no hace (ya documentado así en el código).

**Tech Stack:** TypeScript + Supabase (Postgres). Sin SQL nuevo — `clientes`
ya tiene las columnas `telefono` y `negocio_id` que este cambio necesita.

**Spec:** No hay spec de diseño para esto — es el cierre de un gap
documentado en el propio código
(`src/components/admin/solicitudes/AccionesEstado.tsx`, antes de este
cambio) y en el comentario de riesgos de
`docs/superpowers/specs/2026-09-13-consola-zak-rediseno-design.md`
("La automatización de `cliente` depende de que el bot mande `negocio_id`" —
el spec no vio este segundo bloqueo porque `activarSolicitud` ya fallaba
antes, sin llegar nunca a usar `negocio_id`).

## Global Constraints

- **El gate de pago no se toca.** `activarSolicitud` sigue siendo la única
  puerta que crea un cliente/producto/pago y promueve un negocio a
  `estado = "cliente"` — y sigue disparando solo cuando el admin confirma el
  diálogo "¿Confirmas que el pago llegó?" (`AccionesEstado.tsx`). Ningún
  task de este plan agrega una segunda puerta ni cambia esa condición.
- **Cero tests de componentes** (`vitest.config.ts`: `environment: "node"`,
  `include: ["src/**/__tests__/**/*.test.ts"]`) — pero `activarSolicitud`
  SÍ lleva test: `src/lib/admin/__tests__/solicitudes-actions.test.ts` ya
  existe y ya prueba otras acciones de este mismo archivo con un doble de
  Supabase hecho a mano (sin librería de mocking) — mismo patrón, task 1.
- **No inventar acceso al portal.** Este plan NO crea perfiles, NO manda
  invitaciones, NO toca Supabase Auth. El cliente creado sin cuenta de
  portal se queda así hasta que alguien, en otro momento, decida darle
  acceso — fuera de alcance aquí.

---

### Task 1: `activarSolicitud` resuelve el cliente en 3 caminos (TDD)

**Files:**
- Modify: `src/lib/admin/solicitudes-actions.ts` (función `activarSolicitud`,
  el bloque `// 1. Cliente de la cartera`)
- Test: `src/lib/admin/__tests__/solicitudes-actions.test.ts`

**Interfaces:**
- Consumes: `Solicitud.contacto_nombre`/`contacto_telefono`/`contacto_email`/
  `producto_id`/`negocio_id`/`user_id` (ya existen en
  `@/lib/portal/solicitudes`, sin cambios de tipo). `clientes.telefono`/
  `clientes.negocio_id` (ya existen en el esquema — `src/lib/admin/
  cartera.ts`'s `Cliente` type ya los declara).
- Produces: el comportamiento nuevo de `activarSolicitud` — nadie más lo
  consume directamente (Task 2 solo deja de esconder el botón que ya lo
  llamaba).

- [ ] **Step 1: Escribir los tests (deben fallar — el comportamiento no existe)**

Reemplazar el contenido completo de
`src/lib/admin/__tests__/solicitudes-actions.test.ts` por:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Sin sesión real no hay Supabase en vitest: se captura lo que llega al
// `update`/`delete` (patrón de actions.test.ts).
const {
  updateMock,
  deleteMock,
  verifySessionMock,
  filaMock,
  insertClienteMock,
  updatePerfilMock,
  crearProductoMock,
  registrarPagoMock,
} = vi.hoisted(() => ({
  updateMock: vi.fn(),
  deleteMock: vi.fn(),
  verifySessionMock: vi.fn(),
  filaMock: vi.fn(),
  insertClienteMock: vi.fn(),
  updatePerfilMock: vi.fn(),
  crearProductoMock: vi.fn(),
  registrarPagoMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../dal", () => ({ verifySession: verifySessionMock }));
vi.mock("../cartera-actions", () => ({
  crearProducto: crearProductoMock,
  registrarPago: registrarPagoMock,
}));

function supabaseFalso() {
  return {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: filaMock(), error: null }) }) }),
      update: (fila: unknown) => {
        updateMock(fila);
        return { eq: async () => ({ error: null }) };
      },
      delete: () => {
        deleteMock();
        return { eq: async () => ({ error: null }) };
      },
    }),
  };
}

const SOLICITUD = {
  id: "sol-1",
  user_id: null,
  producto_id: null,
  estado: "nueva",
  origen: "voz",
  contacto_telefono: "+573001112233",
};

describe("actualizarSolicitud / eliminarSolicitud", () => {
  beforeEach(() => {
    updateMock.mockClear();
    deleteMock.mockClear();
    filaMock.mockReturnValue(SOLICITUD);
    verifySessionMock.mockResolvedValue({ supabase: supabaseFalso() });
  });

  it("escribe solo lo validado", async () => {
    const { actualizarSolicitud } = await import("../solicitudes-actions");
    const r = await actualizarSolicitud("sol-1", { contacto_nombre: " María ", contacto_telefono: "3001112233" });
    expect(r).toEqual({ error: null });
    expect(updateMock).toHaveBeenCalledWith({ contacto_nombre: "María", contacto_telefono: "+573001112233" });
  });

  it("un cambio inválido no toca la base", async () => {
    const { actualizarSolicitud } = await import("../solicitudes-actions");
    const r = await actualizarSolicitud("sol-1", { contacto_telefono: "" });
    expect(r.error).toMatch(/teléfono/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("sin solicitud no hace nada", async () => {
    filaMock.mockReturnValue(null);
    const { actualizarSolicitud, eliminarSolicitud } = await import("../solicitudes-actions");
    expect((await actualizarSolicitud("x", { mensaje: "a" })).error).toMatch(/no existe/);
    expect((await eliminarSolicitud("x")).error).toMatch(/no existe/);
    expect(updateMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("eliminar borra la fila", async () => {
    const { eliminarSolicitud } = await import("../solicitudes-actions");
    expect(await eliminarSolicitud("sol-1")).toEqual({ error: null });
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});

// Doble de Supabase específico para activarSolicitud: a diferencia de
// supabaseFalso() (arriba), acá cada tabla responde distinto porque la
// función hace select/insert/update sobre perfiles, productos, clientes Y
// solicitudes en la misma corrida.
function supabaseActivar(cfg: {
  solicitud: Record<string, unknown>;
  perfil?: { cliente_id: string | null; email: string | null; nombre: string | null } | null;
  productoExistente?: { cliente_id: string } | null;
  clienteCreadoId?: string;
}) {
  return {
    from: (tabla: string) => {
      if (tabla === "solicitudes") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: cfg.solicitud, error: null }) }),
          }),
          update: (fila: unknown) => {
            updateMock(fila);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (tabla === "perfiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: cfg.perfil ?? null, error: null }) }),
          }),
          update: (fila: unknown) => {
            updatePerfilMock(fila);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (tabla === "productos") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: cfg.productoExistente ?? null, error: null }),
            }),
          }),
        };
      }
      if (tabla === "clientes") {
        return {
          insert: (fila: unknown) => {
            insertClienteMock(fila);
            return {
              select: () => ({
                single: async () => ({ data: { id: cfg.clienteCreadoId ?? "cli-nuevo" }, error: null }),
              }),
            };
          },
        };
      }
      throw new Error(`tabla no mockeada en este test: ${tabla}`);
    },
  };
}

const BASE_ACTIVABLE = {
  id: "sol-2",
  estado: "pagada",
  cotizacion_monto: "150000",
  cotizacion_ciclo: "unico",
  negocio_id: null,
};

describe("activarSolicitud — resolución del cliente", () => {
  beforeEach(() => {
    updateMock.mockClear();
    insertClienteMock.mockClear();
    updatePerfilMock.mockClear();
    crearProductoMock.mockReset();
    registrarPagoMock.mockReset();
    registrarPagoMock.mockResolvedValue({ error: null });
  });

  it("sin cuenta de portal: crea el cliente directo desde el contacto de la solicitud", async () => {
    const solicitud = {
      ...BASE_ACTIVABLE,
      user_id: null,
      producto_id: null,
      contacto_nombre: "Panadería Doña Rosa",
      contacto_telefono: "+573001112233",
      contacto_email: null,
    };
    crearProductoMock.mockResolvedValue({ id: "prod-1" });
    verifySessionMock.mockResolvedValue({ supabase: supabaseActivar({ solicitud }) });

    const { activarSolicitud } = await import("../solicitudes-actions");
    const r = await activarSolicitud("sol-2");

    expect(r).toEqual({ error: null });
    expect(insertClienteMock).toHaveBeenCalledWith({
      nombre: "Panadería Doña Rosa",
      telefono: "+573001112233",
      email: null,
      negocio_id: null,
    });
  });

  it("sin cuenta de portal: un reintento no duplica el cliente", async () => {
    const solicitud = {
      ...BASE_ACTIVABLE,
      user_id: null,
      producto_id: "prod-1",
      contacto_nombre: "Panadería Doña Rosa",
      contacto_telefono: "+573001112233",
      contacto_email: null,
    };
    verifySessionMock.mockResolvedValue({
      supabase: supabaseActivar({ solicitud, productoExistente: { cliente_id: "cli-existente" } }),
    });

    const { activarSolicitud } = await import("../solicitudes-actions");
    const r = await activarSolicitud("sol-2");

    expect(r).toEqual({ error: null });
    expect(insertClienteMock).not.toHaveBeenCalled();
    expect(crearProductoMock).not.toHaveBeenCalled();
  });

  it("con cuenta de portal: sigue creando el cliente desde el perfil (sin cambios de comportamiento)", async () => {
    const solicitud = { ...BASE_ACTIVABLE, user_id: "user-1", producto_id: null };
    crearProductoMock.mockResolvedValue({ id: "prod-2" });
    verifySessionMock.mockResolvedValue({
      supabase: supabaseActivar({
        solicitud,
        perfil: { cliente_id: null, email: "ana@x.com", nombre: "Ana" },
      }),
    });

    const { activarSolicitud } = await import("../solicitudes-actions");
    const r = await activarSolicitud("sol-2");

    expect(r).toEqual({ error: null });
    expect(insertClienteMock).toHaveBeenCalledWith({ nombre: "Ana", email: "ana@x.com" });
    expect(updatePerfilMock).toHaveBeenCalledWith({ cliente_id: "cli-nuevo" });
  });
});
```

- [ ] **Step 2: Correr los tests, confirmar que los 3 nuevos fallan**

Run: `npx vitest run src/lib/admin/__tests__/solicitudes-actions.test.ts`
Expected: los 4 tests de `actualizarSolicitud / eliminarSolicitud` PASAN
(no se tocó esa lógica); los 3 de `activarSolicitud — resolución del
cliente` FALLAN (la función todavía no soporta `user_id: null`, sigue
devolviendo `"El usuario de la solicitud no tiene perfil."` para los dos
primeros, y probablemente igual pasa el tercero por casualidad — confirmar
que efectivamente hay fallos antes de seguir).

- [ ] **Step 3: Implementar los 3 caminos**

En `src/lib/admin/solicitudes-actions.ts`, reemplazar SOLO este bloque
(dentro de `activarSolicitud`, justo después del guard de
`monto`/`cotizacion_ciclo` y antes de `// 2. Producto contratado`):

```ts
  // 1. Cliente de la cartera (desde el perfil del usuario del portal).
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("user_id, cliente_id, email, nombre")
    .eq("user_id", sol.user_id)
    .maybeSingle();
  if (!perfil) return { error: "El usuario de la solicitud no tiene perfil." };

  let clienteId = perfil.cliente_id as string | null;
  if (!clienteId) {
    const { data: cliente, error: errorCliente } = await supabase
      .from("clientes")
      .insert({
        nombre:
          (perfil.nombre as string | null)?.trim() ||
          (perfil.email as string | null) ||
          "Cliente del portal",
        email: (perfil.email as string | null) ?? null,
      })
      .select("id")
      .single();
    if (errorCliente || !cliente) {
      console.error("[activarSolicitud] cliente", errorCliente?.message);
      return { error: "No se pudo crear el cliente." };
    }
    clienteId = cliente.id as string;

    const { error: errorVinculo } = await supabase
      .from("perfiles")
      .update({ cliente_id: clienteId })
      .eq("user_id", sol.user_id);
    if (errorVinculo) {
      console.error("[activarSolicitud] vínculo", errorVinculo.message);
      return { error: "Se creó el cliente pero no se pudo vincular el perfil." };
    }
  }
```

por:

```ts
  // 1. Cliente de la cartera — tres caminos:
  //    (a) con cuenta de portal: desde el perfil, como siempre;
  //    (b) sin cuenta, reintento: el cliente ya existe, se recupera del
  //        producto ya referenciado (misma idempotencia que protege el
  //        paso 2 más abajo);
  //    (c) sin cuenta, primera vez: se crea directo desde el contacto de
  //        la solicitud. Darle acceso al portal después sigue siendo un
  //        paso aparte que esta función no hace.
  let clienteId: string;
  if (sol.user_id) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("user_id, cliente_id, email, nombre")
      .eq("user_id", sol.user_id)
      .maybeSingle();
    if (!perfil) return { error: "El usuario de la solicitud no tiene perfil." };

    let cid = perfil.cliente_id as string | null;
    if (!cid) {
      const { data: cliente, error: errorCliente } = await supabase
        .from("clientes")
        .insert({
          nombre:
            (perfil.nombre as string | null)?.trim() ||
            (perfil.email as string | null) ||
            "Cliente del portal",
          email: (perfil.email as string | null) ?? null,
        })
        .select("id")
        .single();
      if (errorCliente || !cliente) {
        console.error("[activarSolicitud] cliente", errorCliente?.message);
        return { error: "No se pudo crear el cliente." };
      }
      cid = cliente.id as string;

      const { error: errorVinculo } = await supabase
        .from("perfiles")
        .update({ cliente_id: cid })
        .eq("user_id", sol.user_id);
      if (errorVinculo) {
        console.error("[activarSolicitud] vínculo", errorVinculo.message);
        return { error: "Se creó el cliente pero no se pudo vincular el perfil." };
      }
    }
    clienteId = cid;
  } else if (sol.producto_id) {
    const { data: producto } = await supabase
      .from("productos_contratados")
      .select("cliente_id")
      .eq("id", sol.producto_id)
      .maybeSingle();
    if (!producto) return { error: "No se encontró el producto ya creado." };
    clienteId = producto.cliente_id as string;
  } else {
    const { data: cliente, error: errorCliente } = await supabase
      .from("clientes")
      .insert({
        nombre: sol.contacto_nombre?.trim() || sol.contacto_telefono || "Cliente sin cuenta de portal",
        telefono: sol.contacto_telefono,
        email: sol.contacto_email,
        negocio_id: sol.negocio_id,
      })
      .select("id")
      .single();
    if (errorCliente || !cliente) {
      console.error("[activarSolicitud] cliente", errorCliente?.message);
      return { error: "No se pudo crear el cliente." };
    }
    clienteId = cliente.id as string;
  }
```

(El resto de la función — pasos 2, 3, 4, el `if (sol.negocio_id)` del final,
`revalidarBandeja()` — no cambia ni una línea.)

- [ ] **Step 4: Correr los tests, confirmar que todos pasan**

Run: `npx vitest run src/lib/admin/__tests__/solicitudes-actions.test.ts`
Expected: PASS — 7 tests (4 + 3).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/admin/solicitudes-actions.ts src/lib/admin/__tests__/solicitudes-actions.test.ts
git commit -m "feat: activarSolicitud crea el cliente sin cuenta de portal (TDD)"
```

---

### Task 2: El botón de activar deja de esconderse

**Files:**
- Modify: `src/components/admin/solicitudes/AccionesEstado.tsx`

**Interfaces:**
- Consumes: `activarSolicitud` (Task 1) — ya soporta `s.user_id === null`,
  así que el gate de la UI que lo escondía queda obsoleto.

- [ ] **Step 1: Quitar el gate**

En `src/components/admin/solicitudes/AccionesEstado.tsx`, dentro del bloque
`{(s.estado === "link_enviado" || s.estado === "pagada") && (...)}`,
reemplazar:

```tsx
      <div className="flex flex-wrap items-center gap-2">
        {s.user_id === null ? (
          // activarSolicitud busca el perfil por user_id: en una solicitud
          // de voz o WhatsApp no hay cuenta que buscar, así que el botón
          // fallaría siempre. Crear el cliente y darle acceso al portal es
          // un paso aparte que hoy no hace esta pantalla.
          <p className="text-xs text-tinta-60">
            Para activar, primero crea el cliente y dale acceso al portal — esta solicitud no
            tiene cuenta que vincular.
          </p>
        ) : (
          <Button
            variante="primaria"
            disabled={ocupado}
            onClick={async () => {
              const ok = await confirmar({
                titulo: "¿Confirmas que el pago llegó?",
                mensaje:
                  "Esto crea el cliente y su producto, registra el primer pago y activa el servicio.",
                accion: "Confirmar y activar",
              });
              if (ok) correr(() => activarSolicitud(s.id));
            }}
          >
            {ocupado ? "Activando…" : "Confirmar pago y activar"}
          </Button>
        )}
      </div>
```

por:

```tsx
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variante="primaria"
          disabled={ocupado}
          onClick={async () => {
            const ok = await confirmar({
              titulo: "¿Confirmas que el pago llegó?",
              mensaje:
                "Esto crea el cliente y su producto, registra el primer pago y activa el servicio.",
              accion: "Confirmar y activar",
            });
            if (ok) correr(() => activarSolicitud(s.id));
          }}
        >
          {ocupado ? "Activando…" : "Confirmar pago y activar"}
        </Button>
      </div>
```

No toques nada más del archivo.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: 0 errores (`s` sigue usándose en otras partes del componente —
confirmar que ninguna otra línea dependía de este bloque).

Run: `npx eslint src/components/admin/solicitudes/AccionesEstado.tsx`
Expected: 0 errores/warnings.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/solicitudes/AccionesEstado.tsx
git commit -m "fix: el botón de activar ya no se esconde en solicitudes sin cuenta de portal"
```

---

### Task 3: Verificación final

**Files:** ninguno (solo comandos).

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: 661 + 3 (los 3 tests nuevos de `activarSolicitud`) = 664/664.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 4: Grep de que el gap quedó cerrado**

Run: `grep -n "no tiene cuenta que vincular\|El usuario de la solicitud no tiene perfil" -r src/`
Expected: solo UNA coincidencia — el error dentro de la rama `if (sol.user_id)`
de `solicitudes-actions.ts` (ese SÍ sigue siendo válido: una solicitud CON
`user_id` pero sin perfil es un problema de datos real). La frase de la UI
("no tiene cuenta que vincular") no debe aparecer más.

- [ ] **Step 5: Checklist de QA manual (queda pendiente de verificación humana)**

Escribir en el reporte de esta task, textual, para que Tomás la corra:

- [ ] Una solicitud que llegó por WhatsApp/voz (sin cuenta de portal),
      cotizada y con link enviado: el botón "Confirmar pago y activar" SE
      VE (antes no aparecía).
- [ ] Click en ese botón, confirmar el diálogo → la solicitud pasa a
      "activa", aparece en `/admin/clientes` un cliente nuevo con el
      nombre/teléfono de la solicitud.
- [ ] Si esa solicitud tenía un negocio vinculado (`negocio_id`, viene de
      un chat de Zak): el negocio pasa a `estado = "cliente"` en
      `/admin/prospeccion` — recién DESPUÉS de confirmar el pago, no antes.
- [ ] Una solicitud CON cuenta de portal sigue funcionando exactamente
      igual que antes de este cambio.

- [ ] **Step 6: Commit (solo si hiciera falta alguna corrección)**

Si algún paso anterior encontró un problema y hubo que corregirlo:

```bash
git add -A
git commit -m "fix: ajuste final de activar solicitudes sin cuenta de portal"
```

Si todos los pasos dieron bien, no hay nada que commitear en esta task —
reportar `DONE` igual, sin diff.
