# Tabiques y encuentros T/L — BAT-CUBIKEITOR V4.5

Para dividir un recinto, añade y selecciona un tabique y usa la sección **«Dividir recintos · uniones en T y L»** del panel de propiedades.

- **T:** crea una nueva rama ortogonal desde el centro del tabique seleccionado, hacia el lado positivo o negativo. La rama se detiene ante el siguiente paramento válido.
- **L:** requiere tabique **manual** (`autoSpan` apagado) y conecta una rama desde un extremo de ese tabique. Elige extremo y lado en el formulario.
- **Puertas y cubicación:** las uniones no pueden situarse en vanos de puertas. El resumen muestra cuántos encuentros T y L tiene el proyecto.

No se admiten cruces en X ni penetraciones profundas. El cálculo es geométrico preliminar: no contiene aún materiales de refuerzo ni detalle estructural de encuentros.
