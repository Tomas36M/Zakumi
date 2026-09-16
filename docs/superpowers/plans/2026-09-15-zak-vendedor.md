# Zak vendedor — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que Zak venda todo el catálogo según lo que cada negocio ya tiene (web, contestadora), que una contestadora nunca vuelva a ser un «interesado», y que el traspaso a Tomás llegue con ficha de cierre.

**Architecture:** Dos repos que se despliegan aparte. El **bot** (Flask + Postgres, `whatsapp-bot/`) clasifica cada respuesta como contestadora o persona y lo deja como evidencia en el `contexto` jsonb del prospecto; la guarda dura de `marcar_interesado` vive en el handler de la tool. El **panel** (Next 16, Supabase) arma el repertorio de ganchos y las señales que viajan con el prospecto, deja de promover estados con contestadoras, y da el botón «No era interés real». Los dos toleran al otro viejo: claves ausentes = «no se sabe» = comportamiento de hoy.

**Tech Stack:** Bot: Python 3.9 (venv del repo), Flask, psycopg 3, pytest (los tests de estado necesitan Postgres en Docker). Panel: TypeScript, Next.js 16 App Router, Supabase, vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-zak-vendedor-design.md` (leerlo entero antes de empezar; cada tarea cita su sección).

## Global Constraints

- **Dos worktrees, ya creados desde `origin/main`.** Panel: `PANEL=/Users/tom/Desktop/Zakumi/.claude/worktrees/zak-vendedor` (rama `feat/zak-vendedor`). Bot: `BOT=/Users/tom/Desktop/Zakumi/whatsapp-bot/.claude/worktrees/zak-vendedor` (rama `feat/zak-vendedor` del repo del bot, que es un repo git aparte, anidado y gitignored). Cada comando dice en cuál corre.
- **Python del bot:** `PY=/Users/tom/Desktop/Zakumi/whatsapp-bot/.venv/bin/python` (3.9: todo módulo nuevo lleva `from __future__ import annotations`; nada de `match`). Tests: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q <archivo>`. Sin `DATABASE_URL_TEST` los tests con base se SALTAN y el run no prueba nada del estado: la tarea B0 levanta la base.
- **Tests del panel:** `cd $PANEL && npx vitest run <ruta>`; al final `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- **Repo público (panel):** jamás nombres reales de prospectos, teléfonos reales ni cifras reales del CRM en código, tests, commits o PR. Los ejemplos van inventados (`573001112222`, «La Espiga»). Copy en español de Colombia; la palabra «stack» está prohibida.
- **Commits:** en español, estilo del repo (`zak: …`, `prospección: …`, `leads: …`, `catálogo: …`), un commit por tarea, y todos terminan con la línea `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. `git add` de archivos explícitos, nunca `-A`.
- **Compatibilidad (spec § 5):** el bot se despliega antes que el panel. Toda clave nueva del `contexto` se omite cuando no aplica (nunca `null`), y el panel trata «clave ausente» como hoy.
- **Precios (spec § 4.10):** Zak no dice precios; el bloque de prospección lo repite. Los precios del catálogo cambian solo en `src/lib/catalogo.ts`.

---

## Orden

Bot primero (B0–B9), después el panel (P1–P9). Dentro de cada repo el orden importa: cada tarea usa lo que produjo la anterior.

---

### Task B0: Base de pruebas del bot

**Files:** ninguno (infraestructura local).

- [ ] **Step 1: Levantar Postgres de pruebas (Docker)**

```bash
docker start zk-pg-test 2>/dev/null || docker run -d --name zk-pg-test \
  -e POSTGRES_PASSWORD=test -e POSTGRES_DB=zakumi_test -p 55432:5432 postgres:16-alpine
sleep 3 && docker ps --filter name=zk-pg-test --format '{{.Names}} {{.Status}}'
```

Expected: `zk-pg-test Up …`. Si Docker no está disponible, parar aquí y decirlo: sin base, cada tarea con tests `(db)` queda sin probar y hay que reportarlo así, nunca como «verde».

- [ ] **Step 2: Baseline con base**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q 2>&1 | tail -3`
Expected: `N passed` sin `skipped` por falta de base (`store` aplica `scripts/schema.sql` solo al abrir el pool). Anotar N: es el baseline.

---

### Task B1: Detector de contestadoras (`contestadora.py`)

Spec § 4.5, regla 1 y 2.

**Files:**
- Create: `$BOT/contestadora.py`
- Test: `$BOT/tests/test_contestadora.py`

**Interfaces:**
- Produces: `es_contestadora(texto: str, segundos_desde_nuestro_ultimo: float | None) -> bool`, `normalizar(texto: str) -> str`, `MARCADORES: tuple[str, ...]`. Lo consume B2.

- [ ] **Step 1: Escribir los tests (fallan)**

```python
"""Detector de contestadoras: el mensaje automático de WhatsApp Business no es
una persona. Dos reglas: marcadores de texto, y velocidad + largo."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

BOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT))

from contestadora import MARCADORES, es_contestadora, normalizar  # noqa: E402

# Calcados de contestadoras reales de la bandeja, anonimizados.
AUTO_HORARIO = (
    "¡Gracias por tu mensaje!\n\n"
    "🧔 Recuerda que nuestro horario de atención por *WhatsApp y Tienda física* es:\n\n"
    "🕐 *Lunes a Sábado:*\n12:00pm a 8:00pm\n🕐 *Domingos y Festivos:*\nCerrado"
)
AUTO_MENU = (
    "Mi nombre es *Ana* 🧑‍💼 ¿Cómo podemos ayudarte? 😊\n\n"
    "Te compartimos nuestro menú:\nhttps://ejemplo.invalid/menu"
)
PARRAFO_LARGO = (
    "Hola, somos una tienda de barrio con más de veinte años de historia y nos encanta "
    "atender a nuestros clientes con productos frescos todos los días de la semana"
)


def test_normalizar_quita_tildes_mayusculas_y_espacios():
    assert normalizar("  Horario de ATENCIÓN\n\npor  WhatsApp ") == "horario de atencion por whatsapp"


@pytest.mark.parametrize("marcador", MARCADORES)
def test_cada_marcador_delata_la_contestadora(marcador):
    assert es_contestadora(f"Hola. {marcador.upper()} ✅", None) is True


def test_horario_con_emojis_es_contestadora_aunque_llegue_tarde():
    assert es_contestadora(AUTO_HORARIO, 3600) is True


def test_menu_suelto_es_contestadora():
    assert es_contestadora(AUTO_MENU, 2) is True


def test_parrafo_largo_en_segundos_es_maquina_aunque_no_tenga_marcador():
    assert len(PARRAFO_LARGO) >= 120
    assert es_contestadora(PARRAFO_LARGO, 5) is True


def test_dos_lineas_en_segundos_es_maquina():
    assert es_contestadora("Hola\nEn qué te ayudo", 10) is True


def test_persona_corta_y_rapida_no_es_contestadora():
    assert es_contestadora("hola, quién es?", 8) is False


def test_persona_lenta_y_larga_no_es_contestadora():
    assert es_contestadora(PARRAFO_LARGO, 90) is False


def test_sin_referencia_de_tiempo_solo_cuentan_los_marcadores():
    assert es_contestadora("Hola\nEn qué te ayudo", None) is False


def test_texto_vacio_no_es_contestadora():
    assert es_contestadora("", 1) is False
    assert es_contestadora("   ", 1) is False
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $BOT && $PY -m pytest -q tests/test_contestadora.py`
Expected: `ModuleNotFoundError: No module named 'contestadora'`.

- [ ] **Step 3: Implementar `contestadora.py`**

```python
"""Detector de contestadoras.

Muchos negocios responden con el mensaje automático de WhatsApp Business
(horario, «gracias por tu mensaje», el link del menú). No es una persona: no
se le vende y no cuenta como interés. Dos reglas, cualquiera basta:

1. Marcadores: el texto (en minúsculas y sin tildes) trae una frase de
   contestadora. La lista se alimenta de los textos reales de la bandeja.
2. Velocidad: llegó en ≤ 20 s desde nuestro último mensaje y trae ≥ 2 líneas
   o ≥ 120 caracteres. Una persona no escribe tres párrafos en veinte segundos.

Un falso positivo (una persona rápida y larga) solo retrasa «interesado» hasta
su siguiente mensaje, que la marca humana (ver store.clasificar_respuesta).
"""

from __future__ import annotations

import unicodedata

MARCADORES: tuple = (
    "gracias por tu mensaje",
    "gracias por escribir",
    "gracias por comunicarte",
    "gracias por contactar",
    "horario de atencion",
    "nuestro horario",
    "fuera de horario",
    "en breve",
    "en un momento te",
    "lo antes posible",
    "te responderemos",
    "le responderemos",
    "un asesor te",
    "un asesor se",
    "mensaje automatico",
    "respuesta automatica",
    "bienvenido a",
    "bienvenida a",
    "bienvenidos a",
    "selecciona una opcion",
    "escribe el numero",
    "te compartimos nuestro menu",
)

SEGUNDOS_MAQUINA = 20
LINEAS_MAQUINA = 2
CARACTERES_MAQUINA = 120


def normalizar(texto: str) -> str:
    """Minúsculas, sin tildes y con los espacios (y saltos) colapsados a uno."""
    descompuesto = unicodedata.normalize("NFD", texto or "")
    sin_tildes = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")
    return " ".join(sin_tildes.lower().split())


def es_contestadora(texto: str, segundos_desde_nuestro_ultimo) -> bool:
    limpio = normalizar(texto)
    if not limpio:
        return False
    if any(marcador in limpio for marcador in MARCADORES):
        return True
    if segundos_desde_nuestro_ultimo is None or segundos_desde_nuestro_ultimo > SEGUNDOS_MAQUINA:
        return False
    lineas = [linea for linea in (texto or "").splitlines() if linea.strip()]
    return len(lineas) >= LINEAS_MAQUINA or len(limpio) >= CARACTERES_MAQUINA
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd $BOT && $PY -m pytest -q tests/test_contestadora.py`
Expected: todos en verde (22 marcadores parametrizados + 9).

- [ ] **Step 5: Commit**

```bash
cd $BOT && git add contestadora.py tests/test_contestadora.py && git commit -q -m "zak: detector de contestadoras — marcadores y velocidad, sin tocar la base

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task B2: Clasificar cada respuesta y dejar la evidencia en el contexto

Spec § 4.2 (`contestadora`, `humano`, `interes_descartado`) y § 4.5 «Dónde corre».

**Files:**
- Modify: `$BOT/store.py` (después de `marcar_respondido`, ~línea 738; import arriba)
- Modify: `$BOT/app.py` (`_encolar_para`, ~línea 551, después del `try` de `marcar_respondido`)
- Test: `$BOT/tests/test_contestadora.py` (se añade una sección con base)

**Interfaces:**
- Consumes: `contestadora.es_contestadora` (B1).
- Produces: `store.segundos_desde_nuestro_ultimo(telefono, instancia_id) -> float | None`; `store.actualizar_contexto_prospecto(telefono, instancia_id, cambios: dict, quitar: tuple = ()) -> bool`; `store.clasificar_respuesta(telefono, instancia_id, texto) -> 'contestadora' | 'humano' | None`. Los usan B3, B5, B6, B7.

- [ ] **Step 1: Añadir los tests con base al final de `tests/test_contestadora.py`**

```python
# ---------- Con base: la evidencia queda en el contexto del prospecto ----------

import app as flask_app  # noqa: E402


def _prospecto(s, telefono="573001", instancia_id=1):
    tid = s.crear_tanda(instancia_id, "saludo_zakumi", notas="prueba")
    s.agregar_prospectos(
        tid, instancia_id,
        [{"telefono": telefono, "negocio_id": "uuid-1", "contexto": {"nombre": "Negocio de prueba"}}],
    )
    # El saludo se guarda como mensaje nuestro: es la referencia de tiempo.
    s.guardar_mensaje(telefono, "assistant", "¡Hola! Soy Zak…", instancia_id=instancia_id)
    return tid


def test_una_contestadora_deja_la_marca_y_humano_en_false(dos_instancias):
    s = dos_instancias
    _prospecto(s)
    assert s.clasificar_respuesta("573001", 1, AUTO_HORARIO) == "contestadora"
    ctx = s.prospecto_de("573001", 1)["contexto"]
    assert ctx["contestadora"] is True and ctx["humano"] is False
    assert ctx["nombre"] == "Negocio de prueba"  # el resto del contexto no se pierde


def test_una_persona_pone_humano_y_borra_el_descarte(dos_instancias):
    s = dos_instancias
    _prospecto(s)
    s.actualizar_contexto_prospecto("573001", 1, {"interes_descartado": True})
    assert s.clasificar_respuesta("573001", 1, "hola, quién es?") == "humano"
    ctx = s.prospecto_de("573001", 1)["contexto"]
    assert ctx["humano"] is True
    assert "interes_descartado" not in ctx


def test_humano_es_pegajoso_frente_a_una_contestadora_posterior(dos_instancias):
    s = dos_instancias
    _prospecto(s)
    s.clasificar_respuesta("573001", 1, "hola, quién es?")
    s.clasificar_respuesta("573001", 1, AUTO_HORARIO)
    ctx = s.prospecto_de("573001", 1)["contexto"]
    assert ctx["humano"] is True and ctx["contestadora"] is True


def test_sin_prospecto_no_clasifica(dos_instancias):
    assert dos_instancias.clasificar_respuesta("573999", 1, "hola") is None


def test_segundos_desde_nuestro_ultimo_es_none_sin_mensajes_nuestros(dos_instancias):
    assert dos_instancias.segundos_desde_nuestro_ultimo("573999", 1) is None
    dos_instancias.guardar_mensaje("573999", "assistant", "hola", instancia_id=1)
    assert dos_instancias.segundos_desde_nuestro_ultimo("573999", 1) < 5


def test_el_webhook_clasifica_al_encolar(dos_instancias):
    """La clasificación va en el webhook, donde ya se marca 'respondido': cuenta
    aunque el bot no vaya a contestar (chat pausado, presupuesto agotado)."""
    s = dos_instancias
    inst = s.obtener_instancia(2)
    _prospecto(s, instancia_id=2)
    with flask_app.app.app_context():
        flask_app._encolar_para(inst, "573001", AUTO_HORARIO, "wamid-x")
    p = s.prospecto_de("573001", 2)
    assert p["estado_envio"] == "respondido"
    assert p["contexto"]["contestadora"] is True and p["contexto"]["humano"] is False
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_contestadora.py`
Expected: los 6 nuevos fallan con `AttributeError: module 'store' has no attribute 'clasificar_respuesta'` (o `segundos_desde_nuestro_ultimo`).

- [ ] **Step 3: Implementar en `store.py`**

Arriba, junto a los imports (`from psycopg.types.json import Jsonb`), añadir:

```python
import contestadora
```

Después de `marcar_respondido` (antes de `marcar_interesado`):

```python
def segundos_desde_nuestro_ultimo(telefono: str, instancia_id: int = 1):
    """Segundos desde el último mensaje que ENVIAMOS a este teléfono (el saludo de
    la plantilla se guarda como mensaje del asistente al salir), o None si nunca
    le escribimos. Es la referencia de velocidad del detector de contestadoras."""
    with _cur() as cur:
        cur.execute(
            "SELECT extract(epoch FROM (now() - max(creado_en))) AS segundos FROM mensajes "
            "WHERE instancia_id = %s AND telefono = %s AND rol = 'assistant'",
            (instancia_id, telefono),
        )
        fila = cur.fetchone()
    if fila is None or fila["segundos"] is None:
        return None
    return float(fila["segundos"])


def actualizar_contexto_prospecto(telefono: str, instancia_id: int, cambios: dict,
                                  quitar: tuple = ()) -> bool:
    """Funde `cambios` en el contexto jsonb del prospecto y quita las claves de
    `quitar`. Es LA forma de tocar el contexto: nunca se reemplaza entero, así
    lo que puso el panel (nombre, ganchos, sin_web) y lo que puso el bot
    (humano, contestadora) conviven."""
    with _cur() as cur:
        cur.execute(
            "UPDATE prospectos SET contexto = (contexto || %s) - %s::text[], "
            "actualizado_en = now() WHERE instancia_id = %s AND telefono = %s",
            (Jsonb(cambios), list(quitar), instancia_id, telefono),
        )
        return cur.rowcount == 1


def clasificar_respuesta(telefono: str, instancia_id: int, texto: str):
    """Qué escribió el prospecto: 'contestadora' (mensaje automático), 'humano',
    o None si este teléfono no es un prospecto vigente.

    Deja la evidencia en el contexto. `humano` y `contestadora` son pegajosos
    hacia arriba: una persona que ya escribió no vuelve a ser máquina aunque su
    contestadora siga contestando. Un mensaje humano borra `interes_descartado`
    (el botón del panel) para que el agente pueda volver a marcar interés."""
    p = prospecto_de(telefono, instancia_id)
    if p is None:
        return None
    ctx = p.get("contexto") or {}
    segundos = segundos_desde_nuestro_ultimo(telefono, instancia_id)
    if contestadora.es_contestadora(texto, segundos):
        cambios = {"contestadora": True}
        if ctx.get("humano") is not True:
            cambios["humano"] = False
        actualizar_contexto_prospecto(telefono, instancia_id, cambios)
        return "contestadora"
    actualizar_contexto_prospecto(
        telefono, instancia_id, {"humano": True}, quitar=("interes_descartado",),
    )
    return "humano"
```

- [ ] **Step 4: Cablear el webhook en `app.py`**

En `_encolar_para`, justo después del bloque `try: store.marcar_respondido(...) except ...`:

```python
    # Contestadora o persona: la evidencia que frena los «interesados» de máquina
    # (ver store.clasificar_respuesta). Best-effort, como marcar_respondido.
    try:
        veredicto = store.clasificar_respuesta(phone, inst["id"], text)
        if veredicto:
            print(f"[WEBHOOK {inst['slug']}] {phone} escribió como {veredicto}")
    except Exception as e:  # noqa: BLE001
        print(f"[WEBHOOK {inst['slug']}] clasificar_respuesta: {e}")
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_contestadora.py tests/test_prospeccion.py tests/test_webhooks_multitenant.py`
Expected: todo en verde.

- [ ] **Step 6: Commit**

```bash
cd $BOT && git add store.py app.py tests/test_contestadora.py && git commit -q -m "zak: cada respuesta se clasifica como contestadora o persona y queda en el contexto del prospecto

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task B3: Guarda dura en `marcar_interesado`

Spec § 4.5 «Guarda dura».

**Files:**
- Modify: `$BOT/agent.py` (junto a `_TOOL_MARCAR_INTERESADO` ~línea 625; rama `marcar_interesado` de `_dispatch_tool` ~línea 829)
- Modify: `$BOT/tests/test_prospeccion.py` (`test_con_prospecto_el_system_gana_el_bloque_y_la_tool`, ~línea 415)
- Test: `$BOT/tests/test_interes_real.py` (nuevo)

**Interfaces:**
- Consumes: `store.prospecto_de`, `store.actualizar_contexto_prospecto` (B2).
- Produces: `agent.veredicto_interes(contexto: dict) -> str | None`.

- [ ] **Step 1: Crear `tests/test_interes_real.py` con los tests**

```python
"""Interés real: la guarda dura de marcar_interesado y el botón «No era interés
real». Una contestadora jamás vuelve a ser un interesado."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

BOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT))

import agent  # noqa: E402


# ——— Puro: el veredicto ———


def test_sin_persona_no_hay_interes():
    assert agent.veredicto_interes({}) == agent._RECHAZO_CONTESTADORA
    assert agent.veredicto_interes({"contestadora": True, "humano": False}) == agent._RECHAZO_CONTESTADORA


def test_con_persona_si():
    assert agent.veredicto_interes({"humano": True}) is None


def test_descartado_por_tomas_no_se_vuelve_a_marcar():
    assert agent.veredicto_interes({"humano": True, "interes_descartado": True}) == agent._RECHAZO_DESCARTADO


# ——— Con base: el handler no marca sin persona ———


class _Usage:
    input_tokens = 10
    output_tokens = 5
    cache_creation_input_tokens = 0
    cache_read_input_tokens = 0


class _Bloque:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class _Respuesta:
    def __init__(self, content, stop="end_turn"):
        self.content = content
        self.stop_reason = stop
        self.usage = _Usage()


class _ClienteGuion:
    def __init__(self, respuestas):
        self._respuestas = list(respuestas)
        self.capturas = []
        self.messages = self

    def create(self, **kwargs):
        self.capturas.append(kwargs)
        return self._respuestas.pop(0)


def _instancia_con_prompt(s, iid=2):
    s.guardar_prompt(iid, "Eres el bot de prueba.", "Conocimiento de prueba.", creado_por="test")
    s.invalidar_cache_instancias()
    return s.obtener_instancia(iid)


def _prospecto(s, telefono="573001", instancia_id=2):
    tid = s.crear_tanda(instancia_id, "saludo_zakumi", notas="prueba")
    s.agregar_prospectos(tid, instancia_id, [{"telefono": telefono, "negocio_id": "uuid-1",
                                              "contexto": {"nombre": "Negocio de prueba"}}])
    return tid


def _guion_que_marca():
    return _ClienteGuion([
        _Respuesta([_Bloque(type="tool_use", name="marcar_interesado",
                            input={"resumen": "quiere un bot"}, id="tu_1")], stop="tool_use"),
        _Respuesta([_Bloque(type="text", text="Listo.")]),
    ])


def _tool_result(guion):
    return guion.capturas[1]["messages"][-1]["content"][0]["content"]


def test_el_handler_se_niega_mientras_solo_haya_contestadora(dos_instancias, monkeypatch):
    s = dos_instancias
    inst = _instancia_con_prompt(s)
    _prospecto(s)
    s.actualizar_contexto_prospecto("573001", 2, {"contestadora": True, "humano": False})
    guion = _guion_que_marca()
    monkeypatch.setattr(agent, "get_client", lambda: guion)

    agent.chat("573001", "¡Gracias por tu mensaje!", inst=inst, contexto_contacto=s.prospecto_de("573001", 2))

    assert s.prospecto_de("573001", 2)["interesado"] is False
    assert _tool_result(guion) == agent._RECHAZO_CONTESTADORA


def test_con_persona_el_handler_marca(dos_instancias, monkeypatch):
    s = dos_instancias
    inst = _instancia_con_prompt(s)
    _prospecto(s)
    s.actualizar_contexto_prospecto("573001", 2, {"humano": True})
    guion = _guion_que_marca()
    monkeypatch.setattr(agent, "get_client", lambda: guion)

    agent.chat("573001", "me interesa", inst=inst, contexto_contacto=s.prospecto_de("573001", 2))

    p = s.prospecto_de("573001", 2)
    assert p["interesado"] is True and p["interes_resumen"] == "quiere un bot"
    assert "Marcado como interesado" in _tool_result(guion)
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_interes_real.py`
Expected: `AttributeError: module 'agent' has no attribute 'veredicto_interes'`.

- [ ] **Step 3: Implementar en `agent.py`**

Justo después de la definición de `_TOOL_MARCAR_INTERESADO`:

```python
_RECHAZO_CONTESTADORA = (
    "Este número solo ha respondido con mensajes automáticos (contestadora). No es "
    "interés: sigue conversando y, si escribe una persona, vuelve a intentarlo."
)
_RECHAZO_DESCARTADO = (
    "Tomás ya revisó este chat y no era interés real. Vuelve a marcarlo solo si la "
    "persona escribe algo nuevo que lo demuestre."
)


def veredicto_interes(contexto: dict) -> str | None:
    """Por qué NO se puede marcar interés, o None si sí. Es la guarda dura del
    handler —el modelo no la puede interpretar—: `humano` lo pone el webhook
    (store.clasificar_respuesta) y `interes_descartado` el botón del panel."""
    if contexto.get("humano") is not True:
        return _RECHAZO_CONTESTADORA
    if contexto.get("interes_descartado"):
        return _RECHAZO_DESCARTADO
    return None
```

En `_dispatch_tool`, reemplazar la rama `if name == "marcar_interesado":` entera por:

```python
    if name == "marcar_interesado":
        resumen = (args.get("resumen") or "").strip() or "interés sin detalle"
        p = store.prospecto_de(phone, iid)
        if p is None:
            return "Este chat no es de prospección; no hay prospecto que marcar."
        rechazo = veredicto_interes(p.get("contexto") or {})
        if rechazo is not None:
            print(f"[INTERESADO] inst={inst.get('slug')} {phone}: rechazado — {rechazo[:48]}")
            return rechazo
        if store.marcar_interesado(phone, resumen, instancia_id=iid):
            print(f"[INTERESADO] inst={inst.get('slug')} {phone}: {resumen[:80]}")
            return (
                "Marcado como interesado en el CRM. Sigue la conversación con "
                "naturalidad; si quiere avanzar ya, usa escalar_a_humano."
            )
        return "Este chat no es de prospección; no hay prospecto que marcar."
```

- [ ] **Step 4: Ajustar el test viejo que marcaba sin persona**

En `tests/test_prospeccion.py`, `test_con_prospecto_el_system_gana_el_bloque_y_la_tool`: después de `_tanda_con(s, ["573001"], instancia_id=2)` añadir la línea

```python
    s.actualizar_contexto_prospecto("573001", 2, {"humano": True})  # sin persona la guarda se niega (B3)
```

y **borrar** las seis líneas que van desde `# El ángulo por vertical viaja en el contexto y aterriza en el bloque.` hasta `assert "Ángulo de venta" in bloque and "responder precios al instante" in bloque` (ambas incluidas): el bloque cambia en B4 y tiene sus propios tests.

- [ ] **Step 5: Correr y ver que pasa**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_interes_real.py tests/test_prospeccion.py`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
cd $BOT && git add agent.py tests/test_interes_real.py tests/test_prospeccion.py && git commit -q -m "zak: marcar_interesado se niega mientras no haya escrito una persona (guarda en el handler, no en el prompt)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task B4: El bloque de prospección nuevo

Spec § 4.4 (texto literal).

**Files:**
- Modify: `$BOT/agent.py` (`_BLOQUE_PROSPECTO` y `_bloque_prospecto`, ~líneas 646–670)
- Test: `$BOT/tests/test_bloque_prospecto.py` (nuevo)

**Interfaces:**
- Consumes: claves del contexto `nombre, categoria, ciudad, sin_web, contestadora, humano, interes_descartado, senal_tipica, ganchos, angulo`.
- Produces: `agent._bloque_prospecto(p: dict) -> str` (misma firma de hoy).

- [ ] **Step 1: Tests**

```python
"""El bloque de prospección: lo que Zak lee palabra por palabra en un chat que
él abrió. Sin base: _bloque_prospecto es una función pura sobre el contexto."""

from __future__ import annotations

import sys
from pathlib import Path

BOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT))

import agent  # noqa: E402


def _p(ctx):
    return {"contexto": ctx}


GANCHOS = ["menú con QR", "Zak toma pedidos", "domicilios propios"]


def test_con_repertorio_lista_los_tres_ganchos_y_la_senal():
    b = agent._bloque_prospecto(_p({
        "nombre": "La Brasa", "categoria": "restaurant", "ciudad": "Bogotá",
        "sin_web": True, "senal_tipica": "pedidos por app", "ganchos": GANCHOS,
    }))
    assert "Negocio: La Brasa · Tipo: restaurant · Ciudad: Bogotá" in b
    assert "1) menú con QR  2) Zak toma pedidos  3) domicilios propios" in b
    assert "Lo que suele dolerle a este tipo de negocio: pedidos por app" in b
    assert "Señales: no tiene sitio web" in b
    assert "Ángulo de venta" not in b


def test_sin_repertorio_pide_descubrir_primero_y_conserva_el_angulo_viejo():
    b = agent._bloque_prospecto(_p({"nombre": "X", "angulo": "responder precios al instante"}))
    assert "descubre primero a qué se dedica" in b
    assert "Ángulo de venta para este tipo de negocio: responder precios al instante" in b


def test_ganchos_incompletos_caen_al_generico():
    b = agent._bloque_prospecto(_p({"nombre": "X", "ganchos": ["solo uno"]}))
    assert "descubre primero" in b and "1) " not in b


def test_senales_de_contestadora_y_persona():
    b = agent._bloque_prospecto(_p({"nombre": "X", "contestadora": True, "humano": False}))
    assert "responde con contestadora" in b and "todavía no ha escrito ninguna persona" in b
    b2 = agent._bloque_prospecto(_p({"nombre": "X", "sin_web": False, "humano": True}))
    assert "Señales: tiene sitio web · sin contestadora hasta ahora · ya escribió una persona" in b2


def test_sin_senales_conocidas_lo_dice_sin_inventar_la_web():
    b = agent._bloque_prospecto(_p({"nombre": "X"}))
    assert "Señales: sin contestadora hasta ahora · todavía no ha escrito ninguna persona" in b
    assert "sitio web" not in b.split("Señales:")[1].split("\n")[0]


def test_el_bloque_trae_las_reglas_de_venta():
    b = agent._bloque_prospecto(_p({"nombre": "X"}))
    for frase in (
        "NUNCA una cifra",
        "escríbeme como si fueras tu cliente",
        "nunca con «¿te interesa?»",
        "ficha de cierre completa",
        "no marques interés",
        "UNA pregunta sobre cómo operan hoy",
        "Escalar es tu último mensaje",
    ):
        assert frase in b, frase


def test_descartado_avisa_al_final():
    b = agent._bloque_prospecto(_p({"nombre": "X", "humano": True, "interes_descartado": True}))
    assert b.rstrip().endswith("vuelve a marcarlo solo si una persona escribe algo que lo demuestre.")
    assert "no era interés real" in b


def test_sin_descarte_no_lo_menciona():
    assert "no era interés real" not in agent._bloque_prospecto(_p({"nombre": "X"}))
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $BOT && $PY -m pytest -q tests/test_bloque_prospecto.py`
Expected: fallan todos menos `test_sin_descarte_no_lo_menciona` (el bloque viejo no trae nada de esto).

- [ ] **Step 3: Reemplazar `_BLOQUE_PROSPECTO` y `_bloque_prospecto` en `agent.py`**

Borrar la constante `_BLOQUE_PROSPECTO` y la función `_bloque_prospecto` actuales y poner:

```python
_BLOQUE_PROSPECTO_CABECERA = """# Contexto de prospección (interno, no lo recites)

Este chat es con un negocio que TÚ contactaste primero, como parte de la prospección de Zakumi:
- Negocio: {nombre} · Tipo: {categoria} · Ciudad: {ciudad}
- Señales: {senales}
{ganchos}"""

_LINEAS_REPERTORIO = """- Lo que suele dolerle a este tipo de negocio: {senal_tipica}
- Ganchos para este tipo de negocio, en orden (elige UNO según las señales; nunca los recites todos):
  1) {g1}  2) {g2}  3) {g3}"""

_LINEA_GENERICO = (
    "- Ganchos: descubre primero a qué se dedica y cómo le llegan los clientes; luego elige "
    "entre agente, landing o menú con QR, tienda online, automatización o marca — lo que la "
    "respuesta pida."
)

_BLOQUE_PROSPECTO_CUERPO = """

Tu meta aquí NO es vender ni cotizar: es CALENTAR y ESCALAR, subiendo de a un sí:
respuesta de una persona → una pregunta sobre su operación → una demo aquí mismo → una llamada de 10 minutos con Tomás.

Cómo:
- Ya les llegó tu saludo aprobado. Si preguntan quién eres, preséntate en media línea como Zak, el agente de IA de Zakumi.
- Abre con ellos, no con nosotros: usa el nombre del negocio y lo que compartan (un menú, una foto, un link).
- ANTES de proponer, UNA pregunta sobre cómo operan hoy (cómo les llegan los pedidos o las citas; quién contesta cuando cierran). La respuesta elige el gancho.
- Qué va primero: sin sitio web → existir en internet (landing o menú con QR), no el agente. Con contestadora → no vendas «responder» (ya responden): vende «tomar el pedido» o «agendar», o lo que les falta (web, tienda). Con web y sin contestadora → el agente. Si mencionan una app de domicilios → domicilios propios sin comisión. Si mencionan citas → agenda y recordatorios.
- Enseña UNA cosa que no hayan pensado, en una frase: un pedido por app deja una parte en comisión; un mensaje automático responde pero no toma el pedido; sin web, en Google aparece la app y no ellos.
- La demo es tu mejor argumento: ofrece «escríbeme como si fueras tu cliente y pídeme algo», y toma el pedido o la cita completos con lo que ellos compartieron (menú, servicios, horarios).
- Cierra con alternativa, nunca con «¿te interesa?»: «¿te llamo 10 minutos hoy a las 3 o mañana a las 10?». Si prefieren no llamar, ofrece pasarlos con Tomás para la propuesta.
- Precios: NUNCA una cifra, un rango ni un «desde». Lo que sí puedes decir: «son precios para negocios de barrio, no de agencia; sin permanencia y se prueba antes; Tomás te lo cuadra según lo que necesites» — y escalas.
- Objeciones: «ya tengo WhatsApp Business» → eso responde; tú tomas el pedido completo. «No tengo tiempo» → lo montamos nosotros, solo aprueban; pide la hora. «Es caro» → sin permanencia y se prueba antes; escala. «Ya tengo Rappi» → sigue sirviendo; esto es para que quienes ya lo conocen pidan directo, sin comisión. «Mándame información» → cuéntalo en dos líneas y muéstralo aquí; pregunta qué le quita más tiempo.
- Un mensaje automático del negocio (horario, «gracias por tu mensaje», bienvenida, un menú suelto) NO es una persona: no lo contestes como si lo fuera y no marques interés. Espera a que escriba alguien.
- Cuando detectes interés real de una persona (pregunta cómo funciona, dice que le serviría, pide hablar), llama marcar_interesado con el resumen — y sigue conversando.
- Si quieren avanzar ya o hablar con una persona, llama escalar_a_humano con la ficha de cierre completa: Tomás cierra. Escalar es tu último mensaje en el chat.
- Si piden no ser contactados, discúlpate con calidez, despídete y no insistas.
- No inventes precios ni promesas: solo lo que está en tu base de conocimiento."""

_LINEA_DESCARTADO = (
    "- Tomás ya revisó este chat y no era interés real: vuelve a marcarlo solo si una "
    "persona escribe algo que lo demuestre."
)


def _senales(ctx: dict) -> str:
    """Lo que se sabe del negocio, en el orden en que decide el gancho. `sin_web`
    ausente no se menciona (un prospecto viejo no lo trae)."""
    partes = []
    if ctx.get("sin_web") is True:
        partes.append("no tiene sitio web")
    elif ctx.get("sin_web") is False:
        partes.append("tiene sitio web")
    partes.append("responde con contestadora" if ctx.get("contestadora") else "sin contestadora hasta ahora")
    partes.append(
        "ya escribió una persona" if ctx.get("humano") is True else "todavía no ha escrito ninguna persona"
    )
    return " · ".join(partes)


def _bloque_prospecto(p: dict) -> str:
    ctx = p.get("contexto") or {}
    ganchos = ctx.get("ganchos")
    if (
        isinstance(ganchos, list) and len(ganchos) == 3
        and all(isinstance(g, str) and g.strip() for g in ganchos)
    ):
        lineas = _LINEAS_REPERTORIO.format(
            senal_tipica=(ctx.get("senal_tipica") or "—"), g1=ganchos[0], g2=ganchos[1], g3=ganchos[2],
        )
    else:
        # Sin repertorio (genérico, o un panel viejo): descubrir primero. El
        # ángulo de una frase sigue viajando desde el panel: se conserva.
        lineas = _LINEA_GENERICO
        angulo = (ctx.get("angulo") or "").strip()
        if angulo:
            lineas += f"\n- Ángulo de venta para este tipo de negocio: {angulo}"
    bloque = _BLOQUE_PROSPECTO_CABECERA.format(
        nombre=ctx.get("nombre") or "—",
        categoria=ctx.get("categoria") or "negocio",
        ciudad=ctx.get("ciudad") or "—",
        senales=_senales(ctx),
        ganchos=lineas,
    )
    bloque += _BLOQUE_PROSPECTO_CUERPO
    if ctx.get("interes_descartado"):
        bloque += "\n" + _LINEA_DESCARTADO
    return bloque
```

- [ ] **Step 4: Correr y ver que pasa (y que nada viejo se rompió)**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_bloque_prospecto.py tests/test_prospeccion.py tests/test_interes_real.py`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
cd $BOT && git add agent.py tests/test_bloque_prospecto.py && git commit -q -m "zak: el bloque de prospección vende con señales y ganchos — una pregunta, una demo, un cierre con alternativa y cero precios

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task B5: Todo chat que abre Zak deja prospecto (envío directo con contexto)

Spec § 4.3.

**Files:**
- Modify: `$BOT/store.py` (después de `agregar_prospectos`, ~línea 650)
- Modify: `$BOT/admin_api.py` (`enviar_plantilla_directa`, bloque «Reparación de tanda», ~línea 503)
- Test: `$BOT/tests/test_prospecto_manual.py` (nuevo)

**Interfaces:**
- Produces: `store.tanda_manual(instancia_id, plantilla) -> int`, `store.prospecto_manual(instancia_id, telefono, negocio_id, contexto, plantilla, wamid) -> int`; el endpoint `POST /instancias/{iid}/plantilla` acepta `negocio_id` y `contexto`. Lo consume P3.

- [ ] **Step 1: Tests**

```python
"""Envío directo con contexto: los chats abiertos uno a uno (ficha, «+ Nuevo
chat») dejan prospecto igual que una tanda. Sin contexto, el endpoint sigue
reparando tandas como antes."""

from __future__ import annotations

import pytest

import app as flask_app
import proveedores


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "token-panel")
    flask_app.app.config["TESTING"] = True
    return flask_app.app.test_client()


AUTH = {"Authorization": "Bearer token-panel"}
TEL = "573001112222"


class _RespMeta:
    ok = True
    status_code = 200
    text = ""

    def json(self):
        return {"messages": [{"id": "wamid-1"}]}


def _post(cliente, body):
    return cliente.post("/admin/api/v1/instancias/2/plantilla", json=body, headers=AUTH)


def _abrir(cliente, contexto, negocio_id="uuid-1"):
    return _post(cliente, {
        "telefono": TEL, "plantilla": "saludo_zakumi", "texto": "¡Hola! Soy Zak…",
        "negocio_id": negocio_id, "contexto": contexto,
    })


def test_abrir_un_chat_con_contexto_deja_prospecto_enviado(cliente, dos_instancias, monkeypatch):
    s = dos_instancias
    monkeypatch.setattr(proveedores, "enviar_plantilla", lambda *a, **k: _RespMeta())
    r = _abrir(cliente, {"nombre": "La Espiga", "sin_web": True, "ganchos": ["a", "b", "c"]})
    assert r.status_code == 200
    p = s.prospecto_de(TEL, 2)
    assert p["estado_envio"] == "enviado" and p["wamid"] == "wamid-1"
    assert p["negocio_id"] == "uuid-1" and p["plantilla"] == "saludo_zakumi"
    assert p["contexto"]["ganchos"] == ["a", "b", "c"] and p["contexto"]["sin_web"] is True
    assert [t["notas"] for t in s.listar_tandas(2)] == ["manual"]


def test_reabrir_refresca_el_contexto_sin_perder_interes_ni_evidencia(cliente, dos_instancias, monkeypatch):
    s = dos_instancias
    monkeypatch.setattr(proveedores, "enviar_plantilla", lambda *a, **k: _RespMeta())
    _abrir(cliente, {"nombre": "La Espiga", "sin_web": True, "ganchos": ["a", "b", "c"]})
    s.marcar_respondido(TEL, 2)
    s.actualizar_contexto_prospecto(TEL, 2, {"humano": True})
    s.marcar_interesado(TEL, "quiere un bot", 2)

    r = _abrir(cliente, {"nombre": "La Espiga (nuevo)", "sin_web": False})
    assert r.status_code == 200
    p = s.prospecto_de(TEL, 2)
    assert p["interesado"] is True                       # no se pierde
    assert p["contexto"]["humano"] is True               # la evidencia sobrevive
    assert p["contexto"]["sin_web"] is False             # lo nuevo pisa
    assert p["contexto"]["ganchos"] == ["a", "b", "c"]   # lo que no vino se conserva
    assert p["estado_envio"] == "respondido"             # el funnel no retrocede
    assert len(s.listar_tandas(2)) == 1                  # una sola tanda manual por instancia


def test_sin_contexto_el_endpoint_sigue_reparando_como_antes(cliente, dos_instancias, monkeypatch):
    s = dos_instancias
    monkeypatch.setattr(proveedores, "enviar_plantilla", lambda *a, **k: _RespMeta())
    tid = s.crear_tanda(2, "saludo_zakumi", notas="prueba")
    r = s.agregar_prospectos(tid, 2, [{"telefono": TEL, "contexto": {}}])
    s.marcar_prospecto_fallido(r["creados"][0]["id"], "131049")

    assert _post(cliente, {"telefono": TEL, "plantilla": "saludo_zakumi"}).status_code == 200
    p = s.prospecto_de(TEL, 2)
    assert p["estado_envio"] == "enviado" and p["wamid"] == "wamid-1"
    assert [t["notas"] for t in s.listar_tandas(2)] == ["prueba"]  # sin tanda manual


def test_un_telefono_suelto_sin_negocio_tambien_deja_prospecto(cliente, dos_instancias, monkeypatch):
    s = dos_instancias
    monkeypatch.setattr(proveedores, "enviar_plantilla", lambda *a, **k: _RespMeta())
    assert _abrir(cliente, {"angulo": "x", "saludo": "hola"}, negocio_id=None).status_code == 200
    p = s.prospecto_de(TEL, 2)
    assert p is not None and p["negocio_id"] is None
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_prospecto_manual.py`
Expected: los tres con contexto fallan (`prospecto_de` devuelve None); el de reparación pasa.

- [ ] **Step 3: Implementar en `store.py`** (después de `agregar_prospectos`)

```python
TANDA_MANUAL_NOTAS = "manual"


def tanda_manual(instancia_id: int, plantilla: str) -> int:
    """La tanda que agrupa los chats abiertos uno a uno (ficha del lead, «+ Nuevo
    chat»): una por instancia, se crea la primera vez. La plantilla que guarda es
    la del primer envío: informativa, estos prospectos nacen 'enviado' y el
    worker jamás los reenvía."""
    with _cur() as cur:
        cur.execute(
            "SELECT id FROM tandas WHERE instancia_id = %s AND notas = %s ORDER BY id LIMIT 1",
            (instancia_id, TANDA_MANUAL_NOTAS),
        )
        fila = cur.fetchone()
    if fila is not None:
        return fila["id"]
    return crear_tanda(instancia_id, plantilla, notas=TANDA_MANUAL_NOTAS)


def prospecto_manual(instancia_id: int, telefono: str, negocio_id, contexto: dict,
                     plantilla: str, wamid) -> int:
    """Deja (o refresca) el prospecto de un chat abierto uno a uno, con el mismo
    contexto que una tanda: así el agente recibe el bloque de prospección y
    puede marcar interés también ahí.

    Si ya existía: funde el contexto (lo nuevo pisa, lo que no vino se conserva
    — incluidos `humano` y `contestadora`, que son evidencia del bot), conserva
    `interesado` y la tanda original, y solo repara a 'enviado' lo pendiente o
    fallido: el funnel no retrocede."""
    tid = tanda_manual(instancia_id, plantilla)
    with _cur() as cur:
        cur.execute(
            "INSERT INTO prospectos "
            "(tanda_id, instancia_id, telefono, negocio_id, contexto, estado_envio, wamid) "
            "VALUES (%s, %s, %s, %s, %s, 'enviado', %s) "
            "ON CONFLICT (instancia_id, telefono) DO UPDATE SET "
            "  negocio_id = COALESCE(EXCLUDED.negocio_id, prospectos.negocio_id), "
            "  contexto = prospectos.contexto || EXCLUDED.contexto, "
            "  estado_envio = CASE WHEN prospectos.estado_envio IN ('pendiente', 'fallido') "
            "                      THEN 'enviado' ELSE prospectos.estado_envio END, "
            "  wamid = COALESCE(EXCLUDED.wamid, prospectos.wamid), "
            "  error = NULL, actualizado_en = now() "
            "RETURNING id",
            (tid, instancia_id, telefono, negocio_id, Jsonb(contexto or {}), wamid),
        )
        return cur.fetchone()["id"]
```

- [ ] **Step 4: El endpoint en `admin_api.py`**

En `enviar_plantilla_directa`, reemplazar el bloque que empieza en el comentario `# Reparación de tanda: …` (tres líneas de código) por:

```python
    contexto = datos.get("contexto")
    if isinstance(contexto, dict):
        # Todo chat que abre Zak lleva prospecto: el uno a uno también recibe el
        # bloque de prospección y puede marcar interés (spec Zak vendedor § 4.3).
        negocio_id = datos.get("negocio_id")
        store.prospecto_manual(
            iid, telefono,
            negocio_id if isinstance(negocio_id, str) and negocio_id else None,
            contexto, plantilla, wamid,
        )
    else:
        # Reparación de tanda: un prospecto fallido/pendiente que se reenvía a mano
        # vuelve al funnel como enviado.
        p = store.prospecto_de(telefono, iid)
        if p is not None and p["estado_envio"] in ("pendiente", "fallido") and wamid:
            store.marcar_prospecto_enviado(p["id"], wamid)
```

- [ ] **Step 5: Correr y ver que pasa**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_prospecto_manual.py tests/test_historial_vivo.py tests/test_admin_api.py`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
cd $BOT && git add store.py admin_api.py tests/test_prospecto_manual.py && git commit -q -m "zak: el envío directo con contexto deja prospecto — los chats abiertos uno a uno también son prospección

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task B6: Endpoint «No era interés real»

Spec § 4.7 (lado bot).

**Files:**
- Modify: `$BOT/store.py` (después de `marcar_interesado`)
- Modify: `$BOT/admin_api.py` (después de `borrar_prospecto`, ~línea 556)
- Test: `$BOT/tests/test_interes_real.py` (se añade)

**Interfaces:**
- Produces: `store.descartar_interes(telefono, instancia_id) -> bool`; `POST /instancias/{iid}/prospectos/{telefono}/descartar-interes` → `200 {ok}` / `404` / `400`. Lo consume P6.

- [ ] **Step 1: Añadir al final de `tests/test_interes_real.py`**

```python
# ——— El botón del panel: descartar-interes ———

import app as flask_app  # noqa: E402


@pytest.fixture
def cliente(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "token-panel")
    flask_app.app.config["TESTING"] = True
    return flask_app.app.test_client()


AUTH = {"Authorization": "Bearer token-panel"}


def test_descartar_apaga_el_interes_y_deja_la_marca(cliente, dos_instancias):
    s = dos_instancias
    _prospecto(s)
    s.actualizar_contexto_prospecto("573001", 2, {"humano": True, "contestadora": True})
    s.marcar_interesado("573001", "parecía interés", 2)

    r = cliente.post("/admin/api/v1/instancias/2/prospectos/573001/descartar-interes", headers=AUTH)
    assert r.status_code == 200 and r.get_json() == {"ok": True}
    p = s.prospecto_de("573001", 2)
    assert p["interesado"] is False and p["interes_resumen"] is None
    assert p["contexto"]["interes_descartado"] is True
    assert p["contexto"]["humano"] is True and p["contexto"]["contestadora"] is True  # evidencia intacta
    assert agent.veredicto_interes(p["contexto"]) == agent._RECHAZO_DESCARTADO


def test_un_mensaje_humano_nuevo_levanta_el_descarte(cliente, dos_instancias):
    s = dos_instancias
    _prospecto(s)
    s.guardar_mensaje("573001", "assistant", "hola", instancia_id=2)
    cliente.post("/admin/api/v1/instancias/2/prospectos/573001/descartar-interes", headers=AUTH)
    assert s.clasificar_respuesta("573001", 2, "sí, cuéntame cómo funciona") == "humano"
    assert agent.veredicto_interes(s.prospecto_de("573001", 2)["contexto"]) is None


def test_descartar_sin_prospecto_es_404_y_telefono_malo_400(cliente, dos_instancias):
    assert cliente.post("/admin/api/v1/instancias/2/prospectos/573999/descartar-interes", headers=AUTH).status_code == 404
    assert cliente.post("/admin/api/v1/instancias/2/prospectos/abc/descartar-interes", headers=AUTH).status_code == 400
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_interes_real.py`
Expected: los tres nuevos fallan con 404 (ruta inexistente) o `AttributeError`.

- [ ] **Step 3: Implementar**

`store.py`, después de `marcar_interesado`:

```python
def descartar_interes(telefono: str, instancia_id: int = 1) -> bool:
    """El botón «No era interés real» del panel: apaga `interesado`, borra el
    resumen y deja `interes_descartado` en el contexto para que el agente no lo
    vuelva a marcar hasta que escriba una persona (clasificar_respuesta lo
    borra entonces). `humano` y `contestadora` no se tocan: son evidencia."""
    with _cur() as cur:
        cur.execute(
            "UPDATE prospectos SET interesado = false, interes_resumen = NULL, "
            "contexto = contexto || %s, actualizado_en = now() "
            "WHERE instancia_id = %s AND telefono = %s",
            (Jsonb({"interes_descartado": True}), instancia_id, telefono),
        )
        return cur.rowcount == 1
```

`admin_api.py`, después de `borrar_prospecto`:

```python
@bp.route("/instancias/<int:iid>/prospectos/<telefono>/descartar-interes", methods=["POST"])
@require_admin_token
def descartar_interes(iid, telefono):
    """«No era interés real»: apaga el interés del prospecto y deja la marca para
    que el agente no lo vuelva a poner sin un mensaje humano nuevo."""
    if not _TELEFONO_RE.match(telefono):
        return jsonify({"error": "teléfono inválido (solo dígitos, 7-15)"}), 400
    if not store.descartar_interes(telefono, instancia_id=iid):
        return jsonify({"error": "no hay prospecto para ese teléfono"}), 404
    return jsonify({"ok": True})
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_interes_real.py`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
cd $BOT && git add store.py admin_api.py tests/test_interes_real.py && git commit -q -m "admin: POST descartar-interes — «no era interés real» apaga el interés y deja la marca

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task B7: El panel ve `humano` y `contestadora` (historial, conversaciones, tandas)

Spec § 4.6, tres primeras viñetas y «Métricas».

**Files:**
- Modify: `$BOT/store.py` (`listar_conversaciones` ~línea 477; `listar_tandas` ~línea 787)
- Modify: `$BOT/admin_api.py` (`historial` ~línea 210; `listar_tandas` ~línea 512)
- Test: `$BOT/tests/test_interes_real.py` (se añade)

**Interfaces:**
- Produces: en `/conversations` cada fila trae `humano: true|false|null` y `contestadora: bool`; `/history` trae `humano` y `contestadora`; `/tandas` trae `humanos: int` por tanda. Lo consumen P4 y P5.

- [ ] **Step 1: Tests (al final de `tests/test_interes_real.py`)**

```python
# ——— Lo que ve el panel ———

AUTO = "¡Gracias por tu mensaje! Nuestro horario de atención es de 8 a 5."


def _respuesta(s, texto, telefono="573001", instancia_id=2):
    s.guardar_mensaje(telefono, "assistant", "hola", instancia_id=instancia_id)
    s.marcar_respondido(telefono, instancia_id)
    s.clasificar_respuesta(telefono, instancia_id, texto)
    s.guardar_mensaje(telefono, "user", texto, instancia_id=instancia_id)


def test_conversaciones_e_historial_traen_la_evidencia(cliente, dos_instancias):
    s = dos_instancias
    _prospecto(s)
    _respuesta(s, AUTO)
    convs = cliente.get("/admin/api/v1/instancias/2/conversations", headers=AUTH).get_json()["conversations"]
    fila = next(c for c in convs if c["phone"] == "573001")
    assert fila["humano"] is False and fila["contestadora"] is True
    h = cliente.get("/admin/api/v1/instancias/2/history?telefono=573001", headers=AUTH).get_json()
    assert h["humano"] is False and h["contestadora"] is True


def test_sin_prospecto_humano_es_null_y_contestadora_false(cliente, dos_instancias):
    s = dos_instancias
    s.guardar_mensaje("573777", "user", "hola", instancia_id=2)
    convs = cliente.get("/admin/api/v1/instancias/2/conversations", headers=AUTH).get_json()["conversations"]
    fila = next(c for c in convs if c["phone"] == "573777")
    assert fila["humano"] is None and fila["contestadora"] is False
    h = cliente.get("/admin/api/v1/instancias/2/history?telefono=573777", headers=AUTH).get_json()
    assert h["humano"] is None and h["contestadora"] is False


def test_las_tandas_cuentan_respondidos_humanos(cliente, dos_instancias):
    s = dos_instancias
    tid = s.crear_tanda(2, "saludo_zakumi", notas="prueba")
    s.agregar_prospectos(tid, 2, [
        {"telefono": "573001", "contexto": {}},
        {"telefono": "573002", "contexto": {}},
        {"telefono": "573003", "contexto": {}},
    ])
    _respuesta(s, AUTO, "573001")                      # contestadora → no cuenta
    _respuesta(s, "hola, sí me interesa", "573002")    # persona → cuenta
    s.marcar_respondido("573003", 2)                   # prospecto viejo sin clasificar → cuenta (como hoy)
    t = cliente.get("/admin/api/v1/instancias/2/tandas", headers=AUTH).get_json()["tandas"][0]
    assert t["funnel"]["respondido"] == 3 and t["humanos"] == 2
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_interes_real.py`
Expected: los tres nuevos fallan con `KeyError: 'humano'` / `'humanos'`.

- [ ] **Step 3: `store.listar_conversaciones`**

Reemplazar el SQL por:

```python
            """
            SELECT m.telefono,
                   count(*)                        AS mensajes,
                   (p.telefono IS NOT NULL)        AS pausado,
                   max(m.id)                       AS ultimo_id,
                   max(m.creado_en)                AS ultimo_en,
                   max(pr.contexto->>'humano')       AS humano,
                   max(pr.contexto->>'contestadora') AS contestadora
              FROM mensajes m
              LEFT JOIN pausados p
                     ON p.instancia_id = m.instancia_id AND p.telefono = m.telefono
              LEFT JOIN prospectos pr
                     ON pr.instancia_id = m.instancia_id AND pr.telefono = m.telefono
             WHERE m.instancia_id = %s
             GROUP BY m.telefono, p.telefono
             ORDER BY max(m.id) DESC
             LIMIT %s OFFSET %s
            """,
```

(`max` sobre el texto del jsonb: hay a lo sumo un prospecto por teléfono, así que agrega sin cambiar nada.) Y en el `return`, añadir a cada dict:

```python
            "humano": _tri(f["humano"]),
            "contestadora": f["contestadora"] == "true",
```

con este helper justo antes de `listar_conversaciones`:

```python
def _tri(valor):
    """'true'/'false' del jsonb → bool; cualquier otra cosa (sin prospecto, sin
    clave) → None: «no se sabe» no es «no»."""
    return {"true": True, "false": False}.get(valor)
```

- [ ] **Step 4: `store.listar_tandas`**

Añadir a la lista de columnas del SELECT, después de `interesados`:

```sql
                   count(p.id) FILTER (WHERE p.estado_envio = 'respondido'
                                         AND (p.contexto->>'humano') IS DISTINCT FROM 'false') AS humanos
```

(Respondió una persona, o un prospecto viejo que nadie clasificó: solo se descuenta lo que el bot marcó como máquina.)

- [ ] **Step 5: `admin_api.py`**

En `historial`, antes del `return jsonify(`:

```python
    p = store.prospecto_de(telefono, instancia_id=iid)
    ctx = (p or {}).get("contexto") or {}
```

y dentro del dict, después de `"ultimo_del_cliente"`:

```python
            # Evidencia del prospecto: None sin prospecto o sin clasificar.
            "humano": ctx.get("humano") if isinstance(ctx.get("humano"), bool) else None,
            "contestadora": ctx.get("contestadora") is True,
```

En `listar_tandas` (el endpoint), en el dict de cada tanda añadir `"humanos": f["humanos"],`.

- [ ] **Step 6: Correr y ver que pasa**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_interes_real.py tests/test_historial_vivo.py tests/test_admin_api.py tests/test_prospeccion.py`
Expected: verde.

- [ ] **Step 7: Commit**

```bash
cd $BOT && git add store.py admin_api.py tests/test_interes_real.py && git commit -q -m "admin: conversaciones, historial y tandas exponen si escribió una persona o una contestadora

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task B8: Ficha de cierre en `escalar_a_humano`

Spec § 4.8. La ficha viaja DENTRO del motivo (una sola línea): así `notify(phone, motivo)` y `store.pause(phone, motivo)` no cambian de firma en el worker ni en `proveedores`.

**Files:**
- Modify: `$BOT/agent.py` (schema de `escalar_a_humano` en `TOOLS[3]` ~línea 223 —`_TOOLS_COMUNES` lo reutiliza—; ramas `escalar_a_humano` de `_run_tool` ~línea 778 y `_dispatch_tool` ~línea 819)
- Test: `$BOT/tests/test_ficha_cierre.py` (nuevo)

**Interfaces:**
- Produces: `agent.motivo_con_ficha(motivo: str, ficha) -> str` (una línea, ≤ 1024).

- [ ] **Step 1: Tests**

```python
"""Ficha de cierre: lo que Tomás necesita para cerrar en una llamada de diez
minutos viaja en el aviso de escalado, en UNA línea (los parámetros de plantilla
de Meta no admiten saltos ni más de 1024 caracteres)."""

from __future__ import annotations

import sys
from pathlib import Path

BOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT))

import agent  # noqa: E402


def test_arma_una_linea_con_las_etiquetas_en_orden():
    linea = agent.motivo_con_ficha("quiere propuesta", {
        "tiene_web": "no", "tiene_contestadora": "sí", "usa_app_domicilios": "sí",
        "canal_hoy": "Rappi y llamadas", "dolor": "pierde pedidos\nen la noche",
        "gancho": "domicilios propios", "objecion": "le parece mucho trabajo",
        "mejor_hora": "mañana 10am, llamada",
    })
    assert linea == (
        "quiere propuesta · Web: no · Contestadora: sí · App domicilios: sí · "
        "Pedidos hoy: Rappi y llamadas · Dolor: pierde pedidos en la noche · "
        "Gancho: domicilios propios · Objeción: le parece mucho trabajo · "
        "Mejor hora: mañana 10am, llamada"
    )
    assert "\n" not in linea


def test_omite_lo_vacio_y_lo_que_no_es_texto():
    assert agent.motivo_con_ficha("x", {"dolor": "  ", "gancho": 3, "objecion": None}) == "x"
    assert agent.motivo_con_ficha("x", None) == "x"
    assert agent.motivo_con_ficha("x", "no es un dict") == "x"


def test_sin_motivo_dice_sin_motivo():
    assert agent.motivo_con_ficha("", {"dolor": "cansado"}) == "sin motivo · Dolor: cansado"


def test_recorta_a_1024():
    linea = agent.motivo_con_ficha("m", {"dolor": "a" * 2000})
    assert len(linea) == 1024 and linea.startswith("m · Dolor: aaa")


def test_el_schema_de_la_tool_pide_la_ficha():
    props = agent.TOOLS[3]["input_schema"]["properties"]
    assert agent.TOOLS[3]["name"] == "escalar_a_humano"
    assert set(props["ficha"]["properties"]) == {
        "tiene_web", "tiene_contestadora", "usa_app_domicilios", "canal_hoy",
        "dolor", "gancho", "objecion", "mejor_hora",
    }
    assert agent.TOOLS[3]["input_schema"]["required"] == ["motivo"]


def test_escalar_manda_la_ficha_en_el_aviso_y_pausa(dos_instancias):
    s = dos_instancias
    inst = s.obtener_instancia(2)
    avisos = []
    out = agent._dispatch_tool(
        "573001", "escalar_a_humano",
        {"motivo": "quiere propuesta", "ficha": {"tiene_web": "no", "dolor": "pierde pedidos\nen la noche"}},
        lambda p, m: avisos.append((p, m)), inst, None,
    )
    assert avisos == [("573001", "quiere propuesta · Web: no · Dolor: pierde pedidos en la noche")]
    assert s.is_paused("573001", instancia_id=2)
    assert "escalado" in out.lower()
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_ficha_cierre.py`
Expected: `AttributeError: … 'motivo_con_ficha'`; el del schema falla con `KeyError: 'ficha'`.

- [ ] **Step 3: Implementar**

En `TOOLS[3]` (`escalar_a_humano`), dentro de `"properties"`, después de `"motivo"`:

```python
                "ficha": {
                    "type": "object",
                    "description": (
                        "La ficha de cierre para quien retoma: llénala con lo que sepas. "
                        "En prospección va SIEMPRE."
                    ),
                    "properties": {
                        "tiene_web": {"type": "string", "description": "sí / no / no sé"},
                        "tiene_contestadora": {"type": "string", "description": "sí / no / no sé"},
                        "usa_app_domicilios": {"type": "string", "description": "sí / no / no sé"},
                        "canal_hoy": {"type": "string", "description": "Por dónde le llegan hoy los pedidos o las citas."},
                        "dolor": {"type": "string", "description": "Qué le duele, en sus palabras."},
                        "gancho": {"type": "string", "description": "El gancho que prendió."},
                        "objecion": {"type": "string", "description": "La objeción que quedó abierta."},
                        "mejor_hora": {"type": "string", "description": "Cuándo y por dónde contactarlo."},
                    },
                },
```

Al final de la `description` de esa misma tool, añadir la frase: `" Manda también la ficha de cierre con lo que sepas."`.

Después de `_TOOLS_COMUNES`, añadir:

```python
# La ficha de cierre viaja DENTRO del motivo, en una línea: el aviso a Tomás sale
# como parámetro de plantilla de Meta (sin saltos, ≤ 1024) y `notify`/`pause` no
# cambian de firma. Los campos van de más a menos útil: si hay que recortar, se
# pierde el final.
_CAMPOS_FICHA = (
    ("tiene_web", "Web"),
    ("tiene_contestadora", "Contestadora"),
    ("usa_app_domicilios", "App domicilios"),
    ("canal_hoy", "Pedidos hoy"),
    ("dolor", "Dolor"),
    ("gancho", "Gancho"),
    ("objecion", "Objeción"),
    ("mejor_hora", "Mejor hora"),
)
MOTIVO_MAX = 1024


def motivo_con_ficha(motivo: str, ficha) -> str:
    partes = [" ".join((motivo or "").split()) or "sin motivo"]
    if isinstance(ficha, dict):
        for clave, etiqueta in _CAMPOS_FICHA:
            valor = ficha.get(clave)
            if isinstance(valor, str) and valor.strip():
                partes.append(f"{etiqueta}: {' '.join(valor.split())}")
    return " · ".join(partes)[:MOTIVO_MAX]
```

En `_run_tool`, la rama `escalar_a_humano`: cambiar `motivo = args.get("motivo", "sin motivo")` por `motivo = motivo_con_ficha(args.get("motivo", ""), args.get("ficha"))`. Lo mismo en la rama `escalar_a_humano` de `_dispatch_tool`.

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q tests/test_ficha_cierre.py tests/test_bot.py tests/test_multitenant.py`
Expected: verde (`test_las_cuatro_herramientas_estan_declaradas_con_descripcion` sigue pasando: la tool sigue ahí, con más campos).

- [ ] **Step 5: Commit**

```bash
cd $BOT && git add agent.py tests/test_ficha_cierre.py && git commit -q -m "zak: escalar_a_humano lleva la ficha de cierre, en una línea, dentro del aviso a Tomás

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task B9: Fuera el brochure y la línea de voz del prompt semilla

Spec § 4.9.

**Files:**
- Modify: `$BOT/agent.py` (`_tools_zak_extra`, ~línea 424, y una constante junto a `_TOOL_ENVIAR_BROCHURE`)
- Modify: `$BOT/prompt/system.md` (sección «Lo que no ofrecemos»)
- Modify: `$BOT/tests/test_brochure.py` (`test_con_config_la_tool_dice_cuando_usarla`)
- Test: `$BOT/tests/test_bot.py` (un test nuevo)

- [ ] **Step 1: Tests**

En `tests/test_brochure.py`, cambiar la firma y la primera línea de `test_con_config_la_tool_dice_cuando_usarla`:

```python
def test_con_config_y_encendido_la_tool_dice_cuando_usarla(zak_configurado, monkeypatch):
    monkeypatch.setattr(agent, "BROCHURE_ACTIVO", True)
    tools = {t["name"]: t for t in agent._tools_zak_extra()}
```

(el resto del test igual), y añadir después de él:

```python
def test_por_defecto_el_brochure_esta_apagado(zak_configurado):
    """Los precios del PDF se están redefiniendo (15 sep 2026): hasta que Tomás lo
    vuelva a encender, Zak no lo manda aunque la URL esté configurada."""
    assert agent.BROCHURE_ACTIVO is False
    assert "enviar_brochure" not in {t["name"] for t in agent._tools_zak_extra()}
    assert "llamar_por_voz" in {t["name"] for t in agent._tools_zak_extra()}
```

En `tests/test_bot.py`, después de `test_el_prompt_prohibe_inventar_precios`:

```python
def test_el_prompt_no_niega_la_voz():
    """Zak llama (llamar_por_voz): el prompt no puede decir que no ofrecemos llamadas."""
    texto = agent._PROMPT_PATH.read_text(encoding="utf-8")
    assert "Llamadas telefónicas de voz" not in texto
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $BOT && $PY -m pytest -q tests/test_brochure.py tests/test_bot.py -k "brochure or niega_la_voz"`
Expected: `AttributeError: … 'BROCHURE_ACTIVO'` y el de la voz falla por el assert.

- [ ] **Step 3: Implementar**

En `agent.py`, justo antes de `def _tools_zak_extra()`:

```python
# El brochure trae precios que se están redefiniendo (Tomás, 15 sep 2026): la
# tool no se declara hasta que se vuelva a encender aquí. El código y sus
# tests quedan intactos.
BROCHURE_ACTIVO = False
```

y en `_tools_zak_extra`, cambiar `if _url_brochure():` por `if BROCHURE_ACTIVO and _url_brochure():`.

En `prompt/system.md`, sección «Lo que no ofrecemos», borrar la línea `- Llamadas telefónicas de voz atendidas por IA`.

- [ ] **Step 4: Correr TODO el bot**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q 2>&1 | tail -3`
Expected: verde, sin `skipped` por base, y más tests que el baseline de B0.

- [ ] **Step 5: Commit**

```bash
cd $BOT && git add agent.py prompt/system.md tests/test_brochure.py tests/test_bot.py && git commit -q -m "zak: el brochure queda apagado hasta redefinir precios, y el prompt semilla deja de negar la voz

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task P1: Repertorio por vertical (panel, lógica pura)

Spec § 4.1.

**Files:**
- Create: `$PANEL/src/lib/admin/zak-repertorio.ts`
- Test: `$PANEL/src/lib/admin/__tests__/zak-repertorio.test.ts`

**Interfaces:**
- Produces: `type Repertorio = { senal: string; ganchos: readonly [string, string, string] }`, `REPERTORIO`, `repertorioPara(slug: string): Repertorio | null`. Lo consume P2.

- [ ] **Step 1: Test**

```ts
import { describe, expect, it } from "vitest";
import { VERTICALES_PROSPECCION } from "../zak";
import { REPERTORIO, repertorioPara } from "../zak-repertorio";

describe("repertorioPara", () => {
  it("cada vertical de nicho tiene señal y tres ganchos con texto", () => {
    for (const v of VERTICALES_PROSPECCION) {
      const r = repertorioPara(v.slug);
      expect(r, v.slug).not.toBeNull();
      expect(r!.senal.length).toBeGreaterThan(10);
      expect(r!.ganchos).toHaveLength(3);
      for (const g of r!.ganchos) expect(g.trim().length).toBeGreaterThan(5);
    }
  });

  it("el genérico no tiene repertorio: Zak pregunta primero", () => {
    expect(repertorioPara("generico")).toBeNull();
    expect(repertorioPara("no-existe")).toBeNull();
  });

  // Decisión del 15 sep: solo lo del brochure, y Zak no dice precios.
  it("ningún gancho promete redes sociales ni da precios", () => {
    for (const r of Object.values(REPERTORIO)) {
      for (const g of [r.senal, ...r.ganchos]) {
        expect(g.toLowerCase()).not.toMatch(/redes|instagram|\$|precio/);
      }
    }
  });

  it("no hay repertorios de verticales que no existen", () => {
    const slugs = new Set(VERTICALES_PROSPECCION.map((v) => v.slug));
    for (const slug of Object.keys(REPERTORIO)) expect(slugs.has(slug), slug).toBe(true);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $PANEL && npx vitest run src/lib/admin/__tests__/zak-repertorio.test.ts`
Expected: `Failed to resolve import "../zak-repertorio"`.

- [ ] **Step 3: Implementar `src/lib/admin/zak-repertorio.ts`**

```ts
// El repertorio de venta por vertical: lo que suele dolerle a ese tipo de
// negocio y tres cosas vendibles del brochure, en orden de preferencia. Viaja
// en el contexto del prospecto y el bot lo lee en el bloque de prospección
// (spec 2026-09-15-zak-vendedor § 4.1). Vive en código y no en
// plantillas_zak.angulo a propósito: el seed de esa tabla es `on conflict do
// nothing` y cambiarlo sería SQL en producción; esto se prueba en vitest.
// Regla: solo lo del brochure (agentes, landing/web/tienda, automatización,
// marca), nunca redes sociales ni precios.

export type Repertorio = {
  /** Lo que suele dolerle a este tipo de negocio, en una frase. */
  senal: string;
  /** Tres cosas vendibles, todas del brochure, en orden de preferencia. */
  ganchos: readonly [string, string, string];
};

export const REPERTORIO: Readonly<Record<string, Repertorio>> = {
  restaurante: {
    senal: "pedidos por app de domicilios o por llamada; el menú en un link o una foto",
    ganchos: [
      "menú digital con QR y pedidos por WhatsApp",
      "Zak toma pedidos y reservas completos",
      "domicilios propios con pago en línea, sin comisión de la app",
    ],
  },
  panaderia: {
    senal: "encargos de tortas por chat, uno por uno",
    ganchos: [
      "catálogo con fotos y encargos por WhatsApp",
      "Zak toma encargos con sabor, porciones y fecha",
      "tienda con pago para pedidos anticipados",
    ],
  },
  ferreteria: {
    senal: "«¿tienen X? ¿a cómo?» todo el día por el celular",
    ganchos: [
      "Zak responde precio y disponibilidad desde el catálogo",
      "catálogo web buscable",
      "automatización pedidos ↔ inventario",
    ],
  },
  veterinaria: {
    senal: "citas por llamada, en medio de la consulta",
    ganchos: [
      "Zak agenda citas y manda recordatorios",
      "landing con reservas",
      "recordatorios automáticos de vacunas",
    ],
  },
  farmacia: {
    senal: "domicilios por llamada con el teléfono ocupado",
    ganchos: [
      "Zak toma domicilios con dirección y pago",
      "catálogo con pedidos",
      "automatización con inventario",
    ],
  },
  belleza: {
    senal: "agenda por mensajes directos y llamadas, con las manos ocupadas",
    ganchos: [
      "Zak agenda, reagenda y recuerda",
      "landing de portafolio con reservas",
      "identidad de marca",
    ],
  },
  taller: {
    senal: "cotizaciones por chat mientras el equipo trabaja",
    ganchos: [
      "Zak agenda revisiones y cotiza repuestos",
      "web con servicios y agenda",
      "automatización de órdenes de trabajo",
    ],
  },
  hogar: {
    senal: "cotización con medidas y fotos, y entregas por coordinar",
    ganchos: [
      "Zak cotiza con fotos y coordina la entrega",
      "catálogo web",
      "tienda online",
    ],
  },
  moda: {
    senal: "tallas y apartados por mensajes directos",
    ganchos: [
      "tienda online con pagos",
      "Zak responde tallas y aparta",
      "identidad de marca",
    ],
  },
  comercio: {
    senal: "pedidos y preguntas por chat que se enfrían esperando",
    ganchos: [
      "Zak toma pedidos",
      "landing con botón a WhatsApp",
      "tienda online",
    ],
  },
};

/** El repertorio de un vertical, o null (genérico o desconocido): entonces Zak
 * pregunta primero a qué se dedica el negocio. */
export function repertorioPara(slug: string): Repertorio | null {
  return REPERTORIO[slug] ?? null;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd $PANEL && npx vitest run src/lib/admin/__tests__/zak-repertorio.test.ts`
Expected: 4 en verde.

- [ ] **Step 5: Commit**

```bash
cd $PANEL && git add src/lib/admin/zak-repertorio.ts src/lib/admin/__tests__/zak-repertorio.test.ts && git commit -q -m "zak: repertorio de tres ganchos por vertical, solo con lo del brochure

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task P2: El contexto del prospecto lleva ganchos, señal y `sin_web`

Spec § 4.2 (lado panel).

**Files:**
- Modify: `$PANEL/src/lib/admin/envio.ts` (`prospectoParaTanda`, ~línea 62)
- Modify: `$PANEL/src/lib/bots/tipos.ts` (`Prospecto.contexto`, ~línea 206)
- Test: `$PANEL/src/lib/admin/__tests__/envio.test.ts`

**Interfaces:**
- Consumes: `repertorioPara` (P1), `esSinWeb` (`negocios.ts`), `verticalPara` (`zak.ts`).
- Produces: `type ContextoProspecto`, `contextoDeProspecto(n: Negocio, vertical: VerticalProspeccion, catalogo: CatalogoEnvio): ContextoProspecto`. Lo consume P3.

- [ ] **Step 1: Tests (añadir a `envio.test.ts`, dentro del archivo, junto al describe de `prospectoParaTanda`)**

```ts
describe("contextoDeProspecto", () => {
  it("un restaurante sin web lleva sin_web, la señal y los tres ganchos de su vertical", () => {
    const n = negocio({ categoria: "restaurant", sitio_web: null, telefono: "+573101234567" });
    const c = contextoDeProspecto(n, VERTICAL_GENERICO, CATALOGO);
    expect(c.sin_web).toBe(true);
    expect(c.ganchos).toHaveLength(3);
    expect(c.ganchos?.[0]).toMatch(/QR/);
    expect(c.senal_tipica).toBeTruthy();
    expect(c.angulo).toBe(verticalPorSlug("restaurante").angulo); // sigue viajando (bot viejo)
  });

  it("con web, sin_web es false", () => {
    const n = negocio({ categoria: "bakery", sitio_web: "https://ejemplo.invalid", telefono: "+573101234567" });
    expect(contextoDeProspecto(n, VERTICAL_GENERICO, CATALOGO).sin_web).toBe(false);
  });

  it("un negocio genérico no lleva ganchos ni señal: las claves no van (ni null)", () => {
    const n = negocio({ categoria: "lawyer", telefono: "+573101234567" });
    const c = contextoDeProspecto(n, VERTICAL_GENERICO, CATALOGO);
    expect("ganchos" in c).toBe(false);
    expect("senal_tipica" in c).toBe(false);
    expect(c.sin_web).toBe(true);
  });

  it("prospectoParaTanda usa el mismo contexto", () => {
    const n = negocio({ categoria: "restaurant", telefono: "+573101234567" });
    expect(prospectoParaTanda(n, VERTICAL_GENERICO, CATALOGO).contexto).toEqual(
      contextoDeProspecto(n, VERTICAL_GENERICO, CATALOGO),
    );
  });
});
```

Añadir `contextoDeProspecto` al import de `../envio` al inicio del archivo. El helper `negocio()` del test ya trae `sitio_web` (tipo `Negocio`); si su valor por defecto no es `null`, pasar `sitio_web` explícito como arriba.

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $PANEL && npx vitest run src/lib/admin/__tests__/envio.test.ts`
Expected: `contextoDeProspecto is not a function` (o import inexistente).

- [ ] **Step 3: Implementar en `envio.ts`**

Imports nuevos arriba:

```ts
import { esSinWeb } from "./negocios";
import { repertorioPara } from "./zak-repertorio";
```

Reemplazar `prospectoParaTanda` por:

```ts
/** Lo que el bot sabe del negocio cuando conversa. Las claves de repertorio
 * se OMITEN (nunca null) cuando el vertical no tiene: para el bot, ausente es
 * «no se sabe», y un bot viejo las ignora sin romperse. */
export type ContextoProspecto = {
  nombre: string;
  categoria?: string;
  ciudad?: string;
  /** El ángulo de una frase de siempre: sigue viajando por si el bot desplegado es viejo. */
  angulo: string;
  saludo: string;
  /** De Google Places, vía el CRM: decide qué gancho va primero. */
  sin_web: boolean;
  ganchos?: string[];
  senal_tipica?: string;
};

export function contextoDeProspecto(
  n: Negocio,
  vertical: VerticalProspeccion,
  catalogo: CatalogoEnvio,
): ContextoProspecto {
  const delNegocio = verticalPara(n.categoria, catalogo.verticales, catalogo.generico);
  const repertorio = repertorioPara(delNegocio.slug);
  return {
    nombre: n.nombre,
    categoria: n.categoria ?? undefined,
    ciudad: n.ciudad ?? undefined,
    angulo: delNegocio.angulo,
    saludo: vertical.texto,
    sin_web: esSinWeb(n),
    ...(repertorio
      ? { ganchos: [...repertorio.ganchos], senal_tipica: repertorio.senal }
      : {}),
  };
}

/**
 * Un prospecto para el bot. El saludo es el de la plantilla que sale (con el
 * texto EXACTO del catálogo, el folleto se pinta en la bandeja); el ángulo, la
 * señal y los ganchos son los del tipo de negocio aunque el saludo haya sido el
 * genérico: cuando responda, Zak ya sabe con quién habla y qué venderle.
 */
export function prospectoParaTanda(
  n: Negocio,
  vertical: VerticalProspeccion,
  catalogo: CatalogoEnvio,
) {
  return {
    telefono: sinMas(n.telefono as string),
    negocio_id: n.id,
    contexto: contextoDeProspecto(n, vertical, catalogo),
    componentes: componentesSaludo(vertical),
  };
}
```

En `tipos.ts`, cambiar el tipo de `Prospecto.contexto` por:

```ts
  contexto: {
    nombre?: string;
    categoria?: string;
    ciudad?: string;
    sin_web?: boolean;
    ganchos?: string[];
    senal_tipica?: string;
    /** Evidencia del bot: true = escribió una persona; false = solo contestadora; ausente = sin clasificar. */
    humano?: boolean;
    contestadora?: boolean;
    /** Tomás dijo «no era interés real»; el bot lo borra con el siguiente mensaje humano. */
    interes_descartado?: boolean;
  };
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd $PANEL && npx vitest run src/lib/admin/__tests__/envio.test.ts src/lib/admin/__tests__/zak.test.ts && npx tsc --noEmit`
Expected: verde y sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
cd $PANEL && git add src/lib/admin/envio.ts src/lib/bots/tipos.ts src/lib/admin/__tests__/envio.test.ts && git commit -q -m "zak: el contexto del prospecto lleva sin_web, la señal y los ganchos del vertical

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task P3: Los chats abiertos uno a uno mandan contexto y negocio

Spec § 4.3 (lado panel).

**Files:**
- Modify: `$PANEL/src/lib/bots/api.ts` (`enviarPlantillaDirecta`, ~línea 359)
- Modify: `$PANEL/src/lib/admin/zak-actions.ts` (`abrirChatZak`, ~línea 164; imports)

**Interfaces:**
- Consumes: `contextoDeProspecto` (P2); endpoint del bot (B5).

- [ ] **Step 1: `api.ts`** — añadir a `datos` de `enviarPlantillaDirecta`:

```ts
    /** Con contexto, el bot deja prospecto (igual que una tanda). */
    negocio_id?: string;
    contexto?: Record<string, unknown>;
```

- [ ] **Step 2: `zak-actions.ts`**

Import: cambiar `import { gruposParaEnvio, modoDesdeCliente, prospectoParaTanda } from "./envio";` por `import { contextoDeProspecto, gruposParaEnvio, modoDesdeCliente, prospectoParaTanda } from "./envio";`.

En `abrirChatZak`, antes de `const r = await enviarPlantillaDirecta(ID_ZAK, {`, añadir:

```ts
  // El contexto del prospecto, el mismo que en una tanda: sin él, Zak
  // conversa como el bot genérico del sitio y no puede marcar interés.
  // Un teléfono suelto (sin negocio) lleva solo ángulo y saludo.
  let contexto: Record<string, unknown> = { angulo: vertical.angulo, saludo: vertical.texto };
  if (negocioId) {
    const { data: fila, error } = await supabase
      .from("negocios")
      .select("*")
      .eq("id", negocioId)
      .maybeSingle();
    if (error) console.error("[abrirChatZak] negocio:", error.message);
    if (fila) contexto = contextoDeProspecto(fila as Negocio, vertical, catalogo);
  }
```

y en la llamada a `enviarPlantillaDirecta`, después de `componentes: componentesSaludo(vertical),` añadir:

```ts
    negocio_id: negocioId,
    contexto,
```

- [ ] **Step 3: Tipos y suite**

Run: `cd $PANEL && npx tsc --noEmit && npx vitest run`
Expected: sin errores; toda la suite en verde (781 + los nuevos).

- [ ] **Step 4: Commit**

```bash
cd $PANEL && git add src/lib/bots/api.ts src/lib/admin/zak-actions.ts && git commit -q -m "zak: abrir un chat desde la ficha o «+ Nuevo chat» deja prospecto con contexto en el bot

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task P4: «Respondió» e «Interesado» solo con persona

Spec § 4.6 (`avancesDeEstado`, `consultarRespuestas`, mappers de historial y conversaciones).

**Files:**
- Modify: `$PANEL/src/lib/admin/zak.ts` (`avancesDeEstado`, ~línea 395)
- Modify: `$PANEL/src/lib/admin/estados-chats.ts` (función nueva al final)
- Modify: `$PANEL/src/lib/bots/tipos.ts` (`Conversacion`, `Historial`)
- Modify: `$PANEL/src/lib/bots/mappers.ts` (`mapConversaciones`, `mapHistorial`)
- Modify: `$PANEL/src/lib/admin/zak-actions.ts` (`consultarRespuestas`, ~línea 258)
- Test: `$PANEL/src/lib/admin/__tests__/zak.test.ts`, `$PANEL/src/lib/admin/__tests__/estados-chats.test.ts`, `$PANEL/src/lib/bots/__tests__/mappers.test.ts`

**Interfaces:**
- Produces: `respondioSegunHistorial(h: RespuestaHistorial): boolean` en `estados-chats.ts`; `Historial.humano: boolean | null`, `Historial.contestadora: boolean`, y lo mismo en `Conversacion`.

- [ ] **Step 1: Tests**

En `zak.test.ts`, dentro de `describe("avancesDeEstado")`: en el primer test (`respondido avanza desde nuevo/contactado; interesado desde donde sea`) cambiar los dos prospectos con `interesado: true` para que lleven `contexto: { humano: true }`:

```ts
        prospecto({ negocio_id: "b", estado_envio: "leido", interesado: true, contexto: { humano: true } }),
        prospecto({ negocio_id: "c", estado_envio: "respondido", interesado: true, contexto: { humano: true } }),
```

Hacer lo mismo en `forward-only: no retrocede ni repite` (`b`) y en `jamás toca cliente…` (`a`). Y añadir al final del describe:

```ts
  it("una contestadora no es interés: sin persona, interesado no sube (y respondido sí, como hoy)", () => {
    const avances = avancesDeEstado(
      [
        prospecto({ negocio_id: "a", estado_envio: "respondido", interesado: true }), // sin clasificar
        prospecto({ negocio_id: "b", estado_envio: "respondido", interesado: true, contexto: { humano: false } }),
      ],
      [
        { id: "a", estado: "contactado", estado_fijado_manual: false },
        { id: "b", estado: "contactado", estado_fijado_manual: false },
      ],
    );
    expect(avances).toEqual([{ id: "a", a: "respondido" }]);
  });
```

En `estados-chats.test.ts`, añadir `respondioSegunHistorial` al import y al final:

```ts
describe("respondioSegunHistorial", () => {
  const base = { ultimo_del_cliente: null, messages: [] as { role: "user" | "assistant" }[] };
  it("el bot lo dice: persona sí, solo contestadora no", () => {
    expect(respondioSegunHistorial({ ...base, humano: true })).toBe(true);
    expect(respondioSegunHistorial({ ...base, humano: false, ultimo_del_cliente: "2026-09-15T10:00:00Z" })).toBe(false);
  });
  it("sin veredicto del bot, cuenta como hoy: cualquier mensaje del cliente", () => {
    expect(respondioSegunHistorial({ ...base, humano: null })).toBe(false);
    expect(respondioSegunHistorial({ ...base, humano: null, ultimo_del_cliente: "2026-09-15T10:00:00Z" })).toBe(true);
    expect(respondioSegunHistorial({ ...base, humano: null, messages: [{ role: "user" }] })).toBe(true);
  });
});
```

En `mappers.test.ts`, después del test de `mapConversaciones` existente:

```ts
  it("las conversaciones traen la evidencia del bot; sin ella, humano es null", () => {
    const convs = mapConversaciones({
      conversations: [
        { phone: "573001112222", messages: 2, paused: false, last: "…", last_at: null, humano: false, contestadora: true },
        { phone: "573001112223", messages: 1, paused: false, last: "…", last_at: null },
      ],
    });
    expect(convs[0].humano).toBe(false);
    expect(convs[0].contestadora).toBe(true);
    expect(convs[1].humano).toBeNull();
    expect(convs[1].contestadora).toBe(false);
  });
```

y después del primer test de `mapHistorial`:

```ts
  it("el historial trae humano y contestadora (null/false con bots viejos)", () => {
    const con = mapHistorial({ phone: "573001112222", paused: false, messages: [], ultimo_del_cliente: null, humano: true, contestadora: false });
    expect(con.humano).toBe(true);
    const sin = mapHistorial({ phone: "573001112222", paused: false, messages: [], ultimo_del_cliente: null });
    expect(sin.humano).toBeNull();
    expect(sin.contestadora).toBe(false);
  });
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $PANEL && npx vitest run src/lib/admin/__tests__/zak.test.ts src/lib/admin/__tests__/estados-chats.test.ts src/lib/bots/__tests__/mappers.test.ts`
Expected: fallan el test nuevo de `avancesDeEstado` (devuelve interesado), `respondioSegunHistorial` (no existe) y los de mappers (`undefined`).

- [ ] **Step 3: Implementar**

`zak.ts`, en `avancesDeEstado`, reemplazar el bloque `if (p.interesado && …) … else if (…)` por:

```ts
    // La evidencia del bot: true = escribió una persona, false = solo la
    // contestadora, ausente = prospecto anterior a la clasificación (se trata
    // como hoy). Interesado exige persona; respondido solo se frena con false.
    const humano = p.contexto.humano;
    if (p.interesado && humano === true && n.estado !== "interesado") {
      avances.push({ id: n.id, a: "interesado" });
    } else if (
      p.estado_envio === "respondido" &&
      humano !== false &&
      (n.estado === "nuevo" || n.estado === "contactado")
    ) {
      avances.push({ id: n.id, a: "respondido" });
    }
```

`estados-chats.ts`, al final:

```ts
export type RespuestaHistorial = {
  /** Veredicto del bot: true persona, false solo contestadora, null sin prospecto o bot viejo. */
  humano: boolean | null;
  ultimo_del_cliente: string | null;
  messages: readonly { role: "user" | "assistant" }[];
};

/** Si el negocio respondió como PERSONA. Con veredicto del bot, manda el
 * veredicto; sin él, la regla de siempre: cualquier mensaje del cliente. */
export function respondioSegunHistorial(h: RespuestaHistorial): boolean {
  if (h.humano === true) return true;
  if (h.humano === false) return false;
  return h.ultimo_del_cliente !== null || h.messages.some((m) => m.role === "user");
}
```

`tipos.ts`: a `Conversacion` añadir `humano: boolean | null; contestadora: boolean;` y a `Historial` lo mismo (con el comentario `/** Veredicto del bot: true persona, false solo contestadora, null sin prospecto. */`).

`mappers.ts`: añadir un helper junto a los otros (`texto`, `num`…):

```ts
/** true/false tal cual; cualquier otra cosa es «no se sabe». */
function triestado(v: unknown): boolean | null {
  return v === true ? true : v === false ? false : null;
}
```

y en `mapConversaciones` y `mapHistorial` añadir a cada objeto:

```ts
    humano: triestado(f.humano),
    contestadora: f.contestadora === true,
```

(en `mapHistorial` la variable es `c`, no `f`).

`zak-actions.ts`: importar `respondioSegunHistorial` desde `./estados-chats` (mismo import que `avancesDesdeChats`), y en `consultarRespuestas` cambiar

```ts
    respuestas.set(
      telefonos[i],
      r.data.ultimo_del_cliente !== null || r.data.messages.some((m) => m.role === "user"),
    );
```

por

```ts
    respuestas.set(telefonos[i], respondioSegunHistorial(r.data));
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `cd $PANEL && npx vitest run src/lib/admin src/lib/bots && npx tsc --noEmit`
Expected: verde y sin errores de tipos (si `tsc` se queja de otro sitio que construye `Conversacion`/`Historial` a mano —p. ej. un test—, añadir ahí `humano: null, contestadora: false`).

- [ ] **Step 5: Commit**

```bash
cd $PANEL && git add src/lib/admin/zak.ts src/lib/admin/estados-chats.ts src/lib/admin/zak-actions.ts src/lib/bots/tipos.ts src/lib/bots/mappers.ts src/lib/admin/__tests__/zak.test.ts src/lib/admin/__tests__/estados-chats.test.ts src/lib/bots/__tests__/mappers.test.ts && git commit -q -m "zak: «Respondió» e «Interesado» solo cuando escribió una persona; el panel lee el veredicto del bot

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task P5: Métricas con respuestas humanas

Spec § 4.6, última viñeta.

**Files:**
- Modify: `$PANEL/src/lib/bots/tipos.ts` (`Tanda`)
- Modify: `$PANEL/src/lib/bots/mappers.ts` (`mapTandas`)
- Modify: `$PANEL/src/app/admin/(panel)/metricas/page.tsx` (~línea 46)
- Test: `$PANEL/src/lib/bots/__tests__/mappers.test.ts`

- [ ] **Step 1: Test (en `mappers.test.ts`, junto a los de `mapTandas` si existen; si no, al final del describe principal)**

```ts
  it("las tandas traen respondidos humanos; un bot viejo sin el campo cuenta como el funnel", () => {
    const [nueva, vieja] = mapTandas({
      tandas: [
        { id: 2, plantilla: "p", notas: null, creado_en: "2026-09-15T00:00:00Z", funnel: { respondido: 3 }, interesados: 0, humanos: 2 },
        { id: 1, plantilla: "p", notas: null, creado_en: "2026-09-14T00:00:00Z", funnel: { respondido: 3 }, interesados: 0 },
      ],
    });
    expect(nueva.humanos).toBe(2);
    expect(vieja.humanos).toBe(3);
  });
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $PANEL && npx vitest run src/lib/bots/__tests__/mappers.test.ts`
Expected: `expected undefined to be 2`.

- [ ] **Step 3: Implementar**

`tipos.ts`, en `Tanda`: `/** Respondidos que fueron persona (o sin clasificar); excluye lo que el bot marcó contestadora. */ humanos: number;`.

`mappers.ts`, en `mapTandas`, después de `interesados: num(f.interesados),`:

```ts
      // Un bot anterior a la clasificación no manda `humanos`: vale el funnel.
      humanos: f.humanos === undefined ? num(funnel.respondido) : num(f.humanos),
```

`metricas/page.tsx`: cambiar `const respondidos = tandasData.reduce((t, x) => t + x.funnel.respondido, 0);` por

```ts
  // Respondieron PERSONAS: una contestadora no es una respuesta.
  const respondidos = tandasData.reduce((t, x) => t + x.humanos, 0);
```

- [ ] **Step 4: Correr**

Run: `cd $PANEL && npx vitest run src/lib/bots && npx tsc --noEmit`
Expected: verde.

- [ ] **Step 5: Commit**

```bash
cd $PANEL && git add src/lib/bots/tipos.ts src/lib/bots/mappers.ts "src/app/admin/(panel)/metricas/page.tsx" src/lib/bots/__tests__/mappers.test.ts && git commit -q -m "métricas: la tasa de respuesta cuenta personas, no contestadoras

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task P6: Botón «No era interés real»

Spec § 4.7 (lado panel).

**Files:**
- Modify: `$PANEL/src/lib/bots/api.ts` (función nueva junto a `listarProspectos`)
- Modify: `$PANEL/src/lib/admin/zak.ts` (función pura nueva al final)
- Modify: `$PANEL/src/lib/admin/zak-actions.ts` (action nueva al final; imports)
- Modify: `$PANEL/src/components/admin/bots/Conversaciones.tsx` (cabecera del chat ~línea 577; función nueva junto a `alternarPausa`; imports)
- Modify: `$PANEL/src/components/admin/leads/FichaLeadAcciones.tsx` (prop `onCambio`, botón)
- Modify: `$PANEL/src/components/admin/leads/FichaLeadModal.tsx` (pasar `onCambio` a `FichaLeadAcciones`)
- Test: `$PANEL/src/lib/admin/__tests__/zak.test.ts`

**Interfaces:**
- Consumes: endpoint B6; `Historial.humano` (P4).
- Produces: `descartarInteres(id, telefono)` en `api.ts`; `estadoTrasDescartarInteres(humano: boolean | null): EstadoNegocio` en `zak.ts`; `noEraInteresReal(negocioId: string | null, telefonoBot: string)` en `zak-actions.ts`.

- [ ] **Step 1: Test puro (en `zak.test.ts`, al final)**

```ts
describe("estadoTrasDescartarInteres", () => {
  it("si ya escribió una persona vuelve a Respondió; si no, a Contactado", () => {
    expect(estadoTrasDescartarInteres(true)).toBe("respondido");
    expect(estadoTrasDescartarInteres(false)).toBe("contactado");
    expect(estadoTrasDescartarInteres(null)).toBe("contactado");
  });
});
```

(añadir `estadoTrasDescartarInteres` al import de `../zak`).

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $PANEL && npx vitest run src/lib/admin/__tests__/zak.test.ts`
Expected: import inexistente.

- [ ] **Step 3: Lógica pura y API**

`zak.ts`, al final:

```ts
/** A dónde vuelve un negocio cuando Tomás dice «no era interés real»: si el
 * bot ya vio escribir a una persona, a Respondió; si solo hubo contestadora o
 * no se sabe, a Contactado. Nunca más abajo: el contacto sí ocurrió. */
export function estadoTrasDescartarInteres(humano: boolean | null): EstadoNegocio {
  return humano === true ? "respondido" : "contactado";
}
```

`api.ts`, después de `listarProspectos`:

```ts
/** «No era interés real»: apaga el interés del prospecto y deja la marca para
 * que Zak no lo vuelva a poner sin un mensaje humano nuevo. */
export function descartarInteres(id: number, telefono: string): Promise<Resultado<true>> {
  return pedir(
    "POST",
    `/instancias/${id}/prospectos/${encodeURIComponent(telefono)}/descartar-interes`,
    () => true,
  );
}
```

- [ ] **Step 4: La action en `zak-actions.ts`**

Imports: añadir `estadoTrasDescartarInteres` al import de `./zak`, y `descartarInteres` al import de `@/lib/bots/api`. Al final del archivo:

```ts
/**
 * «No era interés real» (spec Zak vendedor § 4.7): Tomás desmarca a mano un
 * negocio que el bot marcó interesado por una contestadora. Primero el bot
 * (si falla, el CRM no se toca); después el CRM vuelve a Contactado o
 * Respondió según haya escrito una persona. Es el clic de Tomás, no la
 * automatización: sí baja el estado, pero jamás toca cliente ni descartado.
 */
export async function noEraInteresReal(
  negocioId: string | null,
  telefonoBot: string,
): Promise<{ ok: true; estado: EstadoNegocio | null } | { error: string }> {
  const { supabase } = await verifySession();

  const tel = telefonoBot.replace(/\D/g, "");
  if (tel.length < 7 || tel.length > 15) return { error: "Ese teléfono no se entiende." };

  const r = await descartarInteres(ID_ZAK, tel);
  if (!r.ok) {
    return {
      error:
        r.error === "no_existe"
          ? "El bot no tiene prospecto para este chat (se abrió antes de esta versión): cambia el estado a mano en la ficha."
          : "No hay conexión con el bot para desmarcarlo.",
    };
  }

  let estado: EstadoNegocio | null = null;
  if (negocioId) {
    const h = await historial(ID_ZAK, tel);
    estado = estadoTrasDescartarInteres(h.ok ? h.data.humano : null);
    const { error } = await supabase
      .from("negocios")
      .update({ estado })
      .eq("id", negocioId)
      .eq("estado", "interesado");
    if (error) {
      console.error("[noEraInteresReal] negocios:", error.message);
      return { error: "El bot ya lo desmarcó, pero el CRM no se pudo actualizar. Recarga e inténtalo de nuevo." };
    }
  }

  revalidatePath("/admin/zak");
  revalidatePath("/admin/prospeccion");
  return { ok: true, estado };
}
```

- [ ] **Step 5: El botón en la cabecera del chat (`Conversaciones.tsx`)**

Import: cambiar `import { abrirChatZak } from "@/lib/admin/zak-actions";` por `import { abrirChatZak, noEraInteresReal } from "@/lib/admin/zak-actions";`.

Junto a `function alternarPausa()` añadir:

```ts
  async function desmarcarInteres() {
    if (!telefono || !fichaActual) return;
    const ok = await confirmar({
      titulo: "¿No era interés real?",
      mensaje:
        "El negocio vuelve a Contactado (o a Respondió si ya escribió una persona) y Zak no lo volverá a marcar hasta que alguien escriba algo nuevo.",
      accion: "Desmarcar",
    });
    if (!ok) return;
    setAvisoChat(null);
    const negocioId = fichaActual.negocioId;
    startOperar(async () => {
      const res = await noEraInteresReal(negocioId, telefono);
      if ("error" in res) {
        setAvisoChat(res.error);
        return;
      }
      // La ficha del CRM se vuelve a pedir: el badge de estado cambia solo.
      pedidasRef.current.delete(telefono);
      void cruzarConCrm([telefono]);
    });
  }
```

En la cabecera, dentro del `{fichaActual && (<> … </>)}`, después del `<Badge tono={fichaActual.estado}>…</Badge>`:

```tsx
                    {esZak && fichaActual.estado === "interesado" && (
                      <Button disabled={operando} onClick={() => void desmarcarInteres()}>
                        No era interés real
                      </Button>
                    )}
```

- [ ] **Step 6: El botón en la ficha del lead**

`FichaLeadAcciones.tsx`: añadir a `Props` `onCambio?: () => void;` (con el comentario `/** router.refresh() del dueño tras un cambio de estado. */`), recibirlo en la firma, importar `noEraInteresReal` desde `@/lib/admin/zak-actions` y, dentro del segundo `<div className="flex flex-wrap items-center gap-2">`, antes de «Convertir en cliente»:

```tsx
        {negocio.estado === "interesado" && negocio.telefono !== null && (
          <Button
            disabled={ocupado}
            onClick={() => {
              void (async () => {
                const ok = await confirmar({
                  titulo: "¿No era interés real?",
                  mensaje:
                    "Vuelve a Contactado (o a Respondió si ya escribió una persona) y Zak no lo volverá a marcar hasta que alguien escriba algo nuevo.",
                  accion: "Desmarcar",
                });
                if (!ok) return;
                setError(null);
                startAccion(async () => {
                  const res = await noEraInteresReal(negocio.id, negocio.telefono as string);
                  if ("error" in res) {
                    setError(res.error);
                    return;
                  }
                  onCambio?.();
                  router.refresh();
                });
              })();
            }}
          >
            No era interés real
          </Button>
        )}
```

`FichaLeadModal.tsx`: en `<FichaLeadAcciones … />` añadir la prop `onCambio={onCambio}`.

- [ ] **Step 7: Verificar**

Run: `cd $PANEL && npx vitest run src/lib/admin/__tests__/zak.test.ts && npx tsc --noEmit && npm run lint`
Expected: verde, sin errores ni avisos nuevos.

- [ ] **Step 8: Commit**

```bash
cd $PANEL && git add src/lib/bots/api.ts src/lib/admin/zak.ts src/lib/admin/zak-actions.ts src/components/admin/bots/Conversaciones.tsx src/components/admin/leads/FichaLeadAcciones.tsx src/components/admin/leads/FichaLeadModal.tsx src/lib/admin/__tests__/zak.test.ts && git commit -q -m "zak: botón «No era interés real» en el chat y en la ficha — desmarca en el bot y devuelve el estado del CRM

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task P7: Insignia 🤖 contestadora en la bandeja

Spec § 4.6, viñeta «Bandeja».

**Files:**
- Modify: `$PANEL/src/components/admin/bots/Conversaciones.tsx` (fila de la lista ~línea 521; cabecera ~línea 583)

- [ ] **Step 1: Fila de la lista** — después de `{c.paused && <Badge tono="neutro">⏸ pausado</Badge>}`:

```tsx
                    {c.contestadora && !c.humano && (
                      <Badge tono="neutro" title="Solo ha respondido el mensaje automático del negocio">
                        🤖 contestadora
                      </Badge>
                    )}
```

Si `Badge` no acepta `title`, envolver: `<span title="…"><Badge tono="neutro">🤖 contestadora</Badge></span>`.

- [ ] **Step 2: Cabecera del chat** — dentro del `{fichaActual && (<>…</>)}` de la cabecera (después del badge de estado y antes del botón de P6):

```tsx
                    {historial?.contestadora && !historial.humano && (
                      <Badge tono="neutro">🤖 contestadora</Badge>
                    )}
```

- [ ] **Step 3: Verificar**

Run: `cd $PANEL && npx tsc --noEmit && npm run lint`
Expected: limpio.

- [ ] **Step 4: Commit**

```bash
cd $PANEL && git add src/components/admin/bots/Conversaciones.tsx && git commit -q -m "zak: la bandeja señala los chats donde solo ha contestado la contestadora

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task P8: Catálogo con los precios aprobados

Spec § 4.10.

**Files:**
- Modify: `$PANEL/src/lib/catalogo.ts` (`CATALOGO_ZAKUMI`, `CLAVES`)
- Test: `$PANEL/src/lib/__tests__/catalogo.test.ts`

- [ ] **Step 1: Tests** — reemplazar el `describe("precios oficiales del catálogo")` por:

```ts
// Los precios oficiales son los aprobados el 15 sep 2026 para PyMEs (spec
// 2026-09-15-zak-vendedor § 4.10): brochure nuevo y página de precios dicen lo
// mismo que esto. Zak no los dice en el chat.
describe("precios oficiales del catálogo", () => {
  it("el bot de WhatsApp cobra montaje de $199.900 y $129.900 al mes", () => {
    const bot = servicioDelSlug("bot-whatsapp");
    expect(bot?.tarifaSugerida).toBe(129_900);
    expect(bot?.cicloSugerido).toBe("mensual");
    expect(bot?.montaje).toBe(199_900);
  });

  it("landing $590.000, página web $1.190.000 y tienda online $1.490.000, pago único", () => {
    expect(servicioDelSlug("landing")?.tarifaSugerida).toBe(590_000);
    expect(servicioDelSlug("landing")?.cicloSugerido).toBe("unico");
    expect(servicioDelSlug("pagina-web")?.tarifaSugerida).toBe(1_190_000);
    expect(servicioDelSlug("pagina-web")?.montaje).toBeUndefined();
    expect(servicioDelSlug("tienda-online")?.tarifaSugerida).toBe(1_490_000);
    expect(servicioDelSlug("tienda-online")?.tipo).toBe("web");
  });

  it("mantenimiento $49.900, CRM $99.900 y voz $249.900 + $199.900 de montaje", () => {
    expect(servicioDelSlug("mantenimiento-web")?.tarifaSugerida).toBe(49_900);
    expect(servicioDelSlug("crm")?.tarifaSugerida).toBe(99_900);
    expect(servicioDelSlug("agente-voz")?.tarifaSugerida).toBe(249_900);
    expect(servicioDelSlug("agente-voz")?.montaje).toBe(199_900);
  });
});
```

y dentro de `describe("slugDeInteres")` añadir:

```ts
  it("reconoce los productos nuevos antes que página web", () => {
    expect(slugDeInteres("menú con QR para el restaurante")).toBe("landing");
    expect(slugDeInteres("una landing")).toBe("landing");
    expect(slugDeInteres("tienda online con pagos")).toBe("tienda-online");
    expect(slugDeInteres("carrito de compras")).toBe("tienda-online");
    expect(slugDeInteres("página web")).toBe("pagina-web");
  });
```

- [ ] **Step 2: Correr y ver que falla**

Run: `cd $PANEL && npx vitest run src/lib/__tests__/catalogo.test.ts`
Expected: fallan los de precios y el de productos nuevos.

- [ ] **Step 3: Implementar en `catalogo.ts`**

Reemplazar el comentario `// Precios = los del brochure …` y `CATALOGO_ZAKUMI` por:

```ts
// Precios aprobados el 15 sep 2026 para PyMEs (spec 2026-09-15-zak-vendedor
// § 4.10). Brochure y página de precios dicen lo mismo que esto; si cambian
// allá, cambian aquí. Zak no los dice en el chat: cotiza Tomás.
export const CATALOGO_ZAKUMI: readonly Servicio[] = [
  {
    slug: "bot-whatsapp",
    nombre: "Bot de WhatsApp",
    tipo: "bot",
    canal: "whatsapp",
    tarifaSugerida: 129_900,
    cicloSugerido: "mensual",
    montaje: 199_900,
    disponible: true,
    pitch:
      "Un agente que atiende, vende y captura leads por WhatsApp 24/7, con escalado a humano.",
  },
  {
    slug: "landing",
    nombre: "Landing / menú digital con QR",
    tipo: "web",
    canal: null,
    tarifaSugerida: 590_000,
    cicloSugerido: "unico",
    disponible: true,
    pitch:
      "Una página con tu marca, dominio el primer año, botón directo a WhatsApp y QR para el local.",
  },
  {
    slug: "pagina-web",
    nombre: "Página web",
    tipo: "web",
    canal: null,
    tarifaSugerida: 1_190_000,
    cicloSugerido: "unico",
    disponible: true,
    pitch: "Hasta cinco secciones, formulario, SEO local es-CO y botón directo a WhatsApp.",
  },
  {
    slug: "tienda-online",
    nombre: "Tienda online con pagos",
    tipo: "web",
    canal: null,
    tarifaSugerida: 1_490_000,
    cicloSugerido: "unico",
    disponible: true,
    pitch:
      "Catálogo de hasta 50 productos, carrito, pagos con Wompi o Bold y el pedido directo a tu WhatsApp.",
  },
  {
    slug: "mantenimiento-web",
    nombre: "Mantenimiento web",
    tipo: "mantenimiento",
    canal: null,
    tarifaSugerida: 49_900,
    cicloSugerido: "mensual",
    disponible: true,
    pitch: "Hosting, dominio, dos cambios de contenido al mes y soporte, sin dolores de cabeza.",
  },
  {
    slug: "crm",
    nombre: "CRM",
    tipo: "crm",
    canal: null,
    tarifaSugerida: 99_900,
    cicloSugerido: "mensual",
    disponible: true,
    pitch: "Los clientes y pedidos del negocio organizados en un solo lugar.",
  },
  {
    slug: "agente-voz",
    nombre: "Agente de voz",
    tipo: "voz",
    canal: "voz",
    tarifaSugerida: 249_900,
    cicloSugerido: "mensual",
    montaje: 199_900,
    disponible: true,
    pitch:
      "Un agente que contesta y hace llamadas (~US$0.08/min de conversación). " +
      "Por norma debe presentarse como IA al iniciar la llamada.",
  },
] as const;
```

Y `CLAVES` por (el orden importa: lo específico antes que «web»):

```ts
const CLAVES: readonly { slug: string; palabras: readonly string[] }[] = [
  { slug: "mantenimiento-web", palabras: ["mantenimiento", "soporte"] },
  { slug: "landing", palabras: ["landing", "menu", "qr"] },
  { slug: "tienda-online", palabras: ["tienda", "carrito", "ecommerce", "e-commerce", "pagos"] },
  { slug: "bot-whatsapp", palabras: ["whatsapp", "bot", "chatbot"] },
  { slug: "agente-voz", palabras: ["voz", "llamada", "telefono", "call"] },
  { slug: "crm", palabras: ["crm", "clientes"] },
  { slug: "pagina-web", palabras: ["pagina", "web", "sitio"] },
] as const;
```

- [ ] **Step 4: Correr**

Run: `cd $PANEL && npx vitest run src/lib/__tests__/catalogo.test.ts src/lib/admin/__tests__/upsell.test.ts src/lib/admin && npx tsc --noEmit`
Expected: verde (si algún test de solicitudes/upsell asumía los precios viejos o el slug `pagina-web` para «landing», actualizarlo al valor nuevo en el mismo commit).

- [ ] **Step 5: Commit**

```bash
cd $PANEL && git add src/lib/catalogo.ts src/lib/__tests__/catalogo.test.ts && git commit -q -m "catálogo: precios PyME del 15 sep — landing y tienda online nuevas, montajes de bot y voz, mantenimiento y CRM

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task P9: Verificación completa de los dos repos

- [ ] **Step 1: Panel**

Run: `cd $PANEL && npx vitest run 2>&1 | tail -4 && npx tsc --noEmit && npm run lint && npm run build 2>&1 | tail -5`
Expected: todo verde; el build termina sin errores.

- [ ] **Step 2: Bot**

Run: `cd $BOT && DATABASE_URL_TEST=postgresql://postgres:test@localhost:55432/zakumi_test $PY -m pytest -q 2>&1 | tail -3 && git status -sb | head -3`
Expected: verde, working tree limpio en la rama `feat/zak-vendedor`.

- [ ] **Step 3: Cobertura del spec (repasar con el spec abierto)**

| Sección | Tarea |
|---|---|
| 4.1 repertorio | P1 |
| 4.2 señales en el contexto | P2 (panel), B2 (bot) |
| 4.3 todo chat lleva prospecto | B5, P3 |
| 4.4 bloque de prospección | B4 |
| 4.5 detector + guarda | B1, B2, B3 |
| 4.6 lo que ve el panel | B7, P4, P5, P7 |
| 4.7 botón | B6, P6 |
| 4.8 ficha de cierre | B8 |
| 4.9 limpieza | B9 |
| 4.10 catálogo | P8 |
| 5 runbook | va en la descripción de las dos PR (bot primero) |

- [ ] **Step 4: Reportar**

Decir qué pasó de verdad: cuántos tests corrieron en cada repo, si los `db` corrieron con base o se saltaron, y qué quedó fuera. Las PR y el paso manual del prompt vivo (runbook § 5, pasos 3–5) los coordina Tomás.
