#!/usr/bin/env python3
"""Renderiza subtitulos y placa final como PNG RGBA de 1080x1920.

Este ffmpeg no trae drawtext ni libass, asi que el texto se compone con overlay.
Fuentes reales de marca: Inter (cuerpo) + Playfair Display (placa final).
"""
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
CREMA = (245, 239, 227, 255)          # #f5efe3
NARANJA = (219, 82, 39, 255)          # #DB5227
BARRA = (10, 12, 18, 190)             # #0A0C12 semitransparente
OUT = "textos"
os.makedirs(OUT, exist_ok=True)

inter = "fonts/Inter.ttf"
playfair = "fonts/Playfair.ttf"

# (inicio, fin, texto) — tiempos absolutos del video, la voz entra en 4.0 s
SUBS = [
    (4.00, 4.93, "Once de la noche."),
    (5.73, 7.02, "Tu negocio cerró hace rato."),
    (7.84, 8.65, "Tu WhatsApp no."),
    (9.33, 13.07, "Y cada mensaje que no contestas\nes una venta que se fue a otra parte."),
    (14.16, 14.75, "Él es Zak."),
    (15.58, 17.57, "Es un agente de inteligencia artificial."),
    (18.28, 19.07, "Y no duerme."),
    (20.01, 20.97, "Responde el precio."),
    (21.57, 22.52, "Confirma la talla."),
    (23.37, 24.05, "Toma el pedido."),
    (24.81, 25.15, "Cobra."),
    (25.96, 28.12, "Y agenda el domicilio\npara mañana temprano."),
    (29.08, 31.78, "Mientras tanto, Marcela\nhizo algo rarísimo:"),
    (32.45, 33.64, "se acostó a dormir."),
    (34.72, 36.94, "Al otro día no la esperan\nmensajes sin leer."),
    (37.75, 39.78, "La esperan pedidos\nlistos para despachar."),
    (40.62, 41.60, "Eso es Zakumi."),
    (42.39, 47.21, "Un estudio pequeño, en Bogotá,\nque construye tres cosas\npara negocios como el tuyo."),
    (48.16, 52.43, "Agentes de inteligencia artificial\nque atienden y venden\npor WhatsApp, a toda hora."),
    (53.18, 57.03, "Software hecho a tu medida,\npara sacarte de los Excel\ny los cuadernos."),
    (57.64, 59.62, "Y tu marca, publicando sola."),
    (60.50, 61.46, "Escríbele a Zak."),
    (62.12, 63.36, "Te atiende él mismo."),
]


def sub_png(texto, path):
    """Subtitulo centrado sobre barra oscura, en el tercio inferior."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(inter, 46)
    lineas = texto.split("\n")

    alto_linea = 62
    pad_x, pad_y = 40, 26
    anchos = [d.textlength(l, font=f) for l in lineas]
    bw = max(anchos) + pad_x * 2
    bh = alto_linea * len(lineas) + pad_y * 2

    # base de la barra al 82% de la altura: abajo pero sin pegarse al borde
    by = int(H * 0.82) - bh
    bx = (W - bw) / 2
    d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=18, fill=BARRA)

    for i, l in enumerate(lineas):
        lx = (W - anchos[i]) / 2
        ly = by + pad_y + i * alto_linea
        d.text((lx, ly), l, font=f, fill=CREMA)

    img.save(path)


def placa_final(path):
    """ZAKUMI en Playfair + dominio en Inter, alineado a la derecha."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    f_marca = ImageFont.truetype(playfair, 132)
    f_dom = ImageFont.truetype(inter, 44)

    marca, dom = "ZAKUMI", "zakumistudio.com"
    w_marca = d.textlength(marca, font=f_marca)
    w_dom = d.textlength(dom, font=f_dom)

    cx = W / 2
    y = H * 0.42
    d.text((cx - w_marca / 2, y), marca, font=f_marca, fill=CREMA)

    # hairline naranja entre marca y dominio
    ly = y + 178
    d.rectangle([cx - 46, ly, cx + 46, ly + 2], fill=NARANJA)

    d.text((cx - w_dom / 2, ly + 44), dom, font=f_dom, fill=CREMA)
    img.save(path)


if __name__ == "__main__":
    for i, (ini, fin, txt) in enumerate(SUBS):
        sub_png(txt, f"{OUT}/sub{i:02d}.png")
    placa_final(f"{OUT}/placa.png")

    # tabla de tiempos para el script de ffmpeg
    with open(f"{OUT}/tiempos.txt", "w") as fh:
        for i, (ini, fin, _) in enumerate(SUBS):
            fh.write(f"{i:02d} {ini} {fin}\n")

    print(f"{len(SUBS)} subtitulos + placa final")
