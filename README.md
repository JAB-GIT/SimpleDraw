# SimpleDraw 🌌

SimpleDraw es una aplicación web de dibujo vectorial CAD en 2D, construida completamente con tecnologías web estándar (HTML5, CSS3, Vanilla JavaScript) sin depender de frameworks externos. Está diseñada para ser rápida, ligera y ofrecer una experiencia de dibujo técnico y creativo en el navegador.

👉 **[Ver SimpleDraw en vivo](https://jab-git.github.io/SimpleDraw/)**

---

## ✨ Características Principales

### ✏️ Dibujo y Edición Vectorial
*   **Herramienta de Polilínea:** Dibuja líneas continuas y arcos (mediante el sistema de *bulge* tipo CAD) introduciendo distancias numéricas y ángulos precisos.
*   **Etiquetas de Texto:** Añade anotaciones de texto en cualquier parte del lienzo, ajustando su tamaño y precisión.
*   **Selección Múltiple y Edición en Lote:** Selecciona múltiples elementos utilizando la tecla `Shift`. El panel lateral de Propiedades Inteligente mostrará los atributos en común de tu selección mixta, permitiéndote modificarlos todos a la vez.
*   **Copiar, Pegar y Borrar:** Un portapapeles avanzado que conserva las propiedades intrínsecas (como las capas) de los objetos copiados.

### 🧭 Ayudas de Dibujo (Drafting Aids)
*   **Snap a Puntos Finales (Endpoint Snap):** El cursor es magnético y se adhiere a los vértices y puntos medios de geometrías existentes (polilíneas, centros de arcos, textos).
*   **Modo Ortho:** Restringe el movimiento del cursor a ángulos específicos configurables (por defecto, saltos de 90°).
*   **Zoom y Pan:** Navegación infinita sobre el lienzo usando la rueda del ratón, y centrado automático con la herramienta "Zoom Extensión".

### 🌳 El Multiverso (Time Map)
El sistema de Deshacer/Rehacer de SimpleDraw no es lineal, ¡es un **Multiverso**!
*   Cada acción importante crea un nodo en un árbol de historial.
*   Si deshaces un error y tomas un camino distinto, **la versión anterior no se borra**; se crea una rama temporal alternativa.
*   Puedes visualizar gráficamente el árbol del historial en la parte inferior de la pantalla, saltando de una línea temporal a otra con un clic.
*   **Modo Oráculo:** Cuando viajas al pasado, SimpleDraw muestra de manera fantasmal (usando una paleta de colores HSL generativos) los elementos creados en las ramas futuras de esa línea temporal, permitiéndote previsualizar las decisiones que tomaste en el futuro sin tener que saltar a ellas.

### 📄 Layouts y Exportación
*   **Páginas Configurables:** Define áreas de impresión rectangulares con formatos estándar (A4, A3, Carta) o tamaños personalizados. 
*   **Exportación/Impresión:** Un botón dedicado a imprimir exactamente el contenido encapsulado por la página seleccionada, ideal para guardar tus planos en PDF a escala correcta.

### 📂 Gestión de Archivos y Capas
*   **Sistema de Capas:** Crea infinitas capas personalizadas. Controla la visibilidad, asigna colores distintos a cada una y transfiere objetos entre ellas fácilmente a través del panel de propiedades.
*   **Guardado y Carga Nativa:** Utiliza la File System Access API para leer y guardar directamente tu proyecto en archivos `.json` locales, sin necesidad de servidores intermedios.

---

## 🛠️ Tecnologías Utilizadas

*   **Frontend Vanilla:** HTML5, CSS3, JavaScript (ES6+).
*   **HTML5 Canvas API:** Para todo el renderizado de alto rendimiento en 2D.
*   **File System Access API:** Interacción con archivos locales.
*   **Cero dependencias:** No se ha utilizado React, Vue, ni librerías pesadas de terceros. Todo el código, desde las matemáticas vectoriales hasta el renderizador DAG del Multiverso, está construido a medida.

## 🚀 Instalación y Uso Local

Dado que es una aplicación 100% frontend estática, no necesitas node.js, bases de datos ni configuración compleja.

1.  Clona el repositorio:
    ```bash
    git clone https://github.com/jab-git/SimpleDraw.git
    ```
2.  Abre la carpeta `frontend/`.
3.  Simplemente arrastra y suelta `index.html` en tu navegador web moderno (Chrome, Edge, Firefox, Safari).
    *   *Nota: Algunas funciones avanzadas como guardar nativamente requieren que sirvas el archivo mediante un servidor local (e.g., `python -m http.server`) debido a restricciones de seguridad del navegador para protocolos `file://`.*

---

## 📝 Licencia

Este proyecto fue concebido y desarrollado como un CAD web experimental simple pero potente, enfocado en la usabilidad y exploración paramétrica/histórica. 

