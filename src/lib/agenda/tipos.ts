// El contrato del calendario, aparte de su implementación (google.ts) para que
// `entrada.ts` se pueda probar sin red y para que la fase 1 funcione sin
// Google configurado: si no hay calendario, la solicitud igual queda guardada
// y el aviso lo dice.

export type EventoAgendado = {
  eventoId: string;
  meetUrl: string | null;
  linkGoogle: string | null;
};

export type Calendario = {
  /** null = no se pudo crear el evento (red, credenciales, respuesta rara). */
  crearEvento(datos: {
    titulo: string;
    descripcion: string;
    inicio: string;
    fin: string;
  }): Promise<EventoAgendado | null>;
  /** Solo informa: un choque NO impide agendar (perder la cita es peor). */
  hayChoque(inicio: string, fin: string): Promise<boolean>;
};
