CREATE TABLE IF NOT EXISTS public.hogares (
  id UUID PRIMARY KEY,
  nombre TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 60),
  creador_email TEXT NOT NULL REFERENCES public.usuarios(email),
  solicitud UUID NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creador_email, solicitud)
);

CREATE TABLE IF NOT EXISTS public.membresias_hogar (
  hogar_id UUID NOT NULL REFERENCES public.hogares(id),
  usuario_email TEXT NOT NULL REFERENCES public.usuarios(email),
  rol TEXT NOT NULL CHECK (rol IN ('administrador', 'miembro')),
  incorporado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (hogar_id, usuario_email)
);

ALTER TABLE public.hogares
  ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'EUR'
    CHECK (moneda IN ('EUR', 'USD', 'GBP', 'CHF', 'MXN')),
  ADD COLUMN IF NOT EXISTS foto TEXT;

CREATE INDEX IF NOT EXISTS membresias_hogar_usuario ON public.membresias_hogar(usuario_email);

ALTER TABLE public.membresias_hogar ADD COLUMN IF NOT EXISTS id UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS membresias_hogar_id ON public.membresias_hogar(id);

CREATE TABLE IF NOT EXISTS public.tareas_hogar (
  id UUID PRIMARY KEY,
  hogar_id UUID NOT NULL REFERENCES public.hogares(id),
  responsable_email TEXT NOT NULL REFERENCES public.usuarios(email),
  titulo TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 100),
  fecha_limite DATE NOT NULL,
  completada_el DATE
);
CREATE INDEX IF NOT EXISTS tareas_hogar_fecha ON public.tareas_hogar(hogar_id, fecha_limite);
ALTER TABLE public.tareas_hogar ALTER COLUMN fecha_limite DROP NOT NULL;

CREATE TABLE IF NOT EXISTS public.turnos_hogar (
  id UUID PRIMARY KEY,
  hogar_id UUID NOT NULL REFERENCES public.hogares(id),
  titulo TEXT NOT NULL,
  participantes UUID[] NOT NULL CHECK (cardinality(participantes) > 0),
  siguiente_fecha DATE NOT NULL,
  siguiente_posicion INTEGER NOT NULL
);

ALTER TABLE public.tareas_hogar ADD COLUMN IF NOT EXISTS turno_id UUID REFERENCES public.turnos_hogar(id);
ALTER TABLE public.tareas_hogar ADD COLUMN IF NOT EXISTS foto TEXT;
ALTER TABLE public.tareas_hogar ADD COLUMN IF NOT EXISTS oculta BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.tareas_hogar ADD COLUMN IF NOT EXISTS comentarios JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.turnos_hogar ADD COLUMN IF NOT EXISTS dia_mes INTEGER CHECK (dia_mes BETWEEN 1 AND 31);
CREATE UNIQUE INDEX IF NOT EXISTS tareas_hogar_turno_fecha ON public.tareas_hogar(turno_id, fecha_limite);

CREATE TABLE IF NOT EXISTS public.invitaciones_hogar (
  hogar_id UUID PRIMARY KEY REFERENCES public.hogares(id),
  token_hash TEXT NOT NULL UNIQUE,
  caduca_en TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS public.eventos_hogar (
  id UUID PRIMARY KEY,
  hogar_id UUID NOT NULL REFERENCES public.hogares(id),
  autor_email TEXT NOT NULL REFERENCES public.usuarios(email),
  titulo TEXT NOT NULL,
  fecha DATE NOT NULL,
  hora TIME,
  descripcion TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.listas_compra (
  id UUID PRIMARY KEY,
  hogar_id UUID NOT NULL REFERENCES public.hogares(id),
  nombre TEXT NOT NULL,
  productos JSONB NOT NULL DEFAULT '[]'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.movimientos_hogar (id UUID PRIMARY KEY, hogar_id UUID NOT NULL REFERENCES public.hogares(id), datos JSONB NOT NULL, creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS movimientos_hogar_piso ON public.movimientos_hogar(hogar_id);

CREATE TABLE IF NOT EXISTS public.normas_hogar (id UUID PRIMARY KEY,hogar_id UUID NOT NULL REFERENCES public.hogares(id),titulo TEXT NOT NULL,texto TEXT NOT NULL,creado_en TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS normas_hogar_piso ON public.normas_hogar(hogar_id);

CREATE TABLE IF NOT EXISTS public.avisos_hogar (id UUID PRIMARY KEY,hogar_id UUID NOT NULL REFERENCES public.hogares(id),autor_email TEXT NOT NULL REFERENCES public.usuarios(email),texto TEXT NOT NULL,secuencia BIGSERIAL UNIQUE,creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),editado_en TIMESTAMPTZ);
CREATE INDEX IF NOT EXISTS avisos_hogar_piso ON public.avisos_hogar(hogar_id,secuencia);
CREATE TABLE IF NOT EXISTS public.lecturas_avisos (hogar_id UUID NOT NULL REFERENCES public.hogares(id),usuario_email TEXT NOT NULL REFERENCES public.usuarios(email),secuencia BIGINT NOT NULL DEFAULT 0,PRIMARY KEY(hogar_id,usuario_email));
