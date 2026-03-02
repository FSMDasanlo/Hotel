document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENTOS DEL DOM ---
    const createCharacteristicForm = document.getElementById('createCharacteristicForm');
    const characteristicsGrid = document.getElementById('characteristicsGrid');
    const charNameInput = document.getElementById('charName');
    const charCategoryInput = document.getElementById('charCategory');

    // --- DATOS POR DEFECTO (Para inicializar la BD) ---
    const DEFAULT_DATA = {
        "🛏️ 1. Habitaciones": [
            "Tamaño real en m²", "Comodidad de la cama (colchón, almohadas)", "Insonorización (ruido exterior e interior)",
            "Limpieza", "Calidad de sábanas y toallas", "Iluminación (natural y artificial)", "Vistas",
            "Espacio de almacenamiento", "Escritorio o zona de trabajo", "Aire acondicionado / calefacción",
            "Tecnología (Smart TV, enchufes USB, domótica)"
        ],
        "🚿 2. Baño": [
            "Tamaño", "Presión y temperatura del agua", "Ducha vs bañera", "Artículos de aseo (calidad y variedad)",
            "Secador potente", "Espejo de aumento", "Limpieza y mantenimiento", "Ventilación"
        ],
        "🍽️ 3. Gastronomía": [
            "Calidad del desayuno", "Variedad (continental, buffet, a la carta)", "Opciones para dietas especiales",
            "Restaurante propio (calidad/precio)", "Bar / rooftop", "Servicio de habitaciones"
        ],
        "🧑‍💼 4. Atención y servicio": [
            "Amabilidad del personal", "Rapidez en check-in / check-out", "Resolución de problemas",
            "Idiomas disponibles", "Servicio 24h", "Conserjería", "Experiencia personalizada"
        ],
        "📍 5. Ubicación": [
            "Ubicación", "Cercanía a transporte público", "Seguridad del barrio", "Ruido de la zona",
            "Cercanía a puntos turísticos", "Restaurantes y supermercados cerca"
        ],
        "🚗 6. Accesibilidad y transporte": [
            "Parking (precio, cubierto, seguridad)", "Carga para coche eléctrico",
            "Accesibilidad para movilidad reducida", "Traslado aeropuerto"
        ],
        "🧖 7. Instalaciones": [
            "Piscina (interior/exterior)", "Spa", "Gimnasio", "Zonas comunes agradables",
            "Terraza / jardín", "Espacios para trabajar (coworking)", "Salas de reuniones"
        ],
        "🌐 8. Conectividad": [
            "Velocidad real del WiFi", "Estabilidad", "Cobertura en todo el hotel", "Espacios adecuados para teletrabajo"
        ],
        "🧼 9. Limpieza y mantenimiento": [
            "Estado general del edificio", "Renovación reciente", "Olores", "Mantenimiento de ascensores"
        ],
        "💰 10. Relación calidad-precio": [
            "¿Lo que pagas se corresponde con lo recibido?", "Extras ocultos (tasas, resort fee)", "Flexibilidad de cancelación"
        ],
        "🌱 11. Sostenibilidad": [
            "Política ecológica", "Eliminación de plásticos", "Energía renovable", "Certificaciones ambientales"
        ],
        "👶 12. Perfil del hotel": [
            "Familiar", "Solo adultos", "Romántico", "Negocios", "Boutique", "Lujo", "Low-cost", "Pet-friendly"
        ],
        "⭐ 13. Experiencia subjetiva": [
            "¿Volverías? (Sí/No)", "Nota global", "Mejor punto fuerte", "Peor punto débil", "Tipo de viaje"
        ]
    };

    // Referencia a la colección de Firestore (la variable `db` viene de firebase-config.js)
    const characteristicsCollection = db.collection('characteristics');

    // --- LÓGICA DE LA UI ---

    // Manejar el envío del formulario para crear una característica
    createCharacteristicForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const characteristicData = {
            name: charNameInput.value,
            category: charCategoryInput.value,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        try {
            await characteristicsCollection.add(characteristicData);
            console.log('Característica creada con éxito');
            createCharacteristicForm.reset();
        } catch (error) {
            console.error("Error al crear la característica: ", error);
            alert('Hubo un error al crear la característica.');
        }
    });

    // --- RENDERIZADO ---

    // --- LÓGICA DE FIREBASE ---

    // Escuchar cambios en tiempo real en la colección de características
    characteristicsCollection.orderBy('category').onSnapshot(snapshot => {
        if (snapshot.empty) {
            characteristicsGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">No hay características definidas. Usa el botón de arriba para cargar las predeterminadas.</p>';
            return;
        }

        // 1. Agrupar los datos por categoría
        const groupedData = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            
            if (!groupedData[data.category]) {
                groupedData[data.category] = [];
            }
            groupedData[data.category].push({ id, ...data });
        });

        // 2. Renderizar las tarjetas
        characteristicsGrid.innerHTML = ''; // Limpiar grid
        
        // Ordenar las categorías por el número que tienen al principio
        const sortedCategories = Object.keys(groupedData).sort((a, b) => {
            const numA = parseInt(a.match(/^.*?(\d+)\./)?.[1] || 0);
            const numB = parseInt(b.match(/^.*?(\d+)\./)?.[1] || 0);
            return numA - numB;
        });

        sortedCategories.forEach(category => {
            // Crear tarjeta de categoría
            const card = document.createElement('div');
            card.classList.add('category-card');
            
            // Header de la tarjeta
            const header = document.createElement('div');
            header.classList.add('category-header');
            header.textContent = category;
            card.appendChild(header);

            // Lista de items
            const list = document.createElement('div');
            list.classList.add('category-list');

            groupedData[category].forEach(item => {
                const row = document.createElement('div');
                row.classList.add('category-list-item');
                row.innerHTML = `
                    <span>${item.name}</span>
                    <div class="actions">
                        <button class="btn-delete" data-id="${item.id}"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
                
                // Evento borrar
                row.querySelector('.btn-delete').addEventListener('click', async () => {
                    if(confirm(`¿Borrar "${item.name}"?`)) {
                        await characteristicsCollection.doc(item.id).delete();
                    }
                });

                list.appendChild(row);
            });

            card.appendChild(list);
            characteristicsGrid.appendChild(card);
        });

    }, error => {
        console.error("Error al obtener características: ", error);
        characteristicsGrid.innerHTML = '<p>Error al cargar las características.</p>';
    });
});