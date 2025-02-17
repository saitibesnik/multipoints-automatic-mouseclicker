from cairosvg import svg2png
import os

# Größen für die Icons
sizes = [16, 32, 48, 128]

# Lese SVG-Datei
with open('logo.svg', 'rb') as f:
    svg_data = f.read()

# Konvertiere zu verschiedenen Größen
for size in sizes:
    output_file = f'logo{size}.png'
    svg2png(bytestring=svg_data,
            write_to=output_file,
            output_width=size,
            output_height=size)
    print(f'Created {output_file}')
