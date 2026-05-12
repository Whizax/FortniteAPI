// --------------------------------------------------------------
// VARIABLES GLOBALES
// --------------------------------------------------------------
const API_URL = 'https://fortnite-api.com/v2/cosmetics';
const SHOP_URL = 'https://fortnite-api.com/v2/shop';
const NEWS_URL = 'https://fortnite-api.com/v2/news/br';

let allCosmetics = [];
let allShopItems = [];
let isotopeInstance = null;
let currentRarityFilter = '*';
let currentTypeFilter = '*';

// Variables para el comparador
let allSkinsList = [];
let currentSkin1 = null;
let currentSkin2 = null;

// Favoritos guardados en el navegador
let favorites = JSON.parse(localStorage.getItem('fortniteFavorites')) || [];

// Historial de comparaciones
let comparisonHistory = JSON.parse(localStorage.getItem('fortniteHistory')) || [];

function saveFavorites() {
    localStorage.setItem('fortniteFavorites', JSON.stringify(favorites));
}

function saveHistory() {
    localStorage.setItem('fortniteHistory', JSON.stringify(comparisonHistory));
}

// --------------------------------------------------------------
// SONIDOS
// --------------------------------------------------------------
let audioCtx = null;

function initAudio() {
    if (!audioCtx && window.AudioContext) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playSound(type, volume = 0.1) {
    try {
        initAudio();
        if (!audioCtx) return;
        
        const now = audioCtx.currentTime;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(volume, now);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, now + 0.2);
        
        switch(type) {
            case 'click':
                oscillator.type = 'sine';
                oscillator.frequency.value = 880;
                oscillator.start(now);
                oscillator.stop(now + 0.12);
                break;
            case 'select':
                oscillator.type = 'sine';
                oscillator.frequency.value = 440;
                oscillator.start(now);
                oscillator.stop(now + 0.2);
                break;
            case 'hover':
                oscillator.type = 'sine';
                oscillator.frequency.value = 660;
                gainNode.gain.setValueAtTime(0.05, now);
                oscillator.start(now);
                oscillator.stop(now + 0.08);
                break;
            case 'like':
                oscillator.type = 'sine';
                oscillator.frequency.value = 1046.50;
                oscillator.start(now);
                oscillator.stop(now + 0.15);
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.type = 'sine';
                osc2.frequency.value = 1318.52;
                gain2.gain.setValueAtTime(0.08, now);
                gain2.gain.exponentialRampToValueAtTime(0.00001, now + 0.15);
                osc2.start(now);
                osc2.stop(now + 0.15);
                break;
            case 'notification':
                oscillator.type = 'sine';
                oscillator.frequency.value = 523.25;
                oscillator.start(now);
                oscillator.stop(now + 0.2);
                const osc3 = audioCtx.createOscillator();
                const gain3 = audioCtx.createGain();
                osc3.connect(gain3);
                gain3.connect(audioCtx.destination);
                osc3.type = 'sine';
                osc3.frequency.value = 659.25;
                gain3.gain.setValueAtTime(0.08, now);
                gain3.gain.exponentialRampToValueAtTime(0.00001, now + 0.2);
                osc3.start(now + 0.1);
                osc3.stop(now + 0.3);
                break;
        }
    } catch(e) { console.log('Audio no soportado'); }
}

function playBeep(type) { playSound(type); }
function playHover() { playSound('hover', 0.05); }

// --------------------------------------------------------------
// NOTIFICACIONES EMERGENTES (TOASTS)
// --------------------------------------------------------------
function showToast(title, message, soundType = 'notification') {
    playSound(soundType, 0.1);
    const toast = $(`<div class="toast-notification">${title}<br><small>${message}</small></div>`);
    $('body').append(toast);
    toast.addClass('show');
    setTimeout(() => {
        toast.removeClass('show');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// --------------------------------------------------------------
// ANIMACIÓN DE CHISPAS (para el like)
// --------------------------------------------------------------
function createSparkles(x, y) {
    for (let i = 0; i < 12; i++) {
        const spark = $('<div class="like-spark"></div>');
        const angle = (i / 12) * Math.PI * 2;
        const distance = 40 + Math.random() * 30;
        spark.css({
            '--tx': Math.cos(angle) * distance + 'px',
            '--ty': Math.sin(angle) * distance + 'px',
            position: 'absolute',
            left: x + 'px',
            top: y + 'px'
        });
        $('body').append(spark);
        setTimeout(() => spark.remove(), 500);
    }
}

// --------------------------------------------------------------
// TEMPORADA DE ORIGEN
// --------------------------------------------------------------
function getSkinSeason(skin) {
    if (skin.introduction) {
        const intro = skin.introduction;
        if (intro.chapter && intro.season) {
            return `Capítulo ${intro.chapter}, Temporada ${intro.season}`;
        }
        if (intro.text) {
            return intro.text;
        }
    }
    if (skin.added) {
        const date = new Date(skin.added);
        return `Añadido: ${date.toLocaleDateString('es-ES')}`;
    }
    return 'Temporada desconocida';
}

// --------------------------------------------------------------
// HISTORIAL DE COMPARACIONES
// --------------------------------------------------------------
function addToHistory(skin1, skin2) {
    if (!skin1 || !skin2) return;
    
    const historyItem = {
        id: Date.now(),
        skin1Name: skin1.name,
        skin2Name: skin2.name,
        skin1Id: skin1.id,
        skin2Id: skin2.id,
        date: new Date().toLocaleString()
    };
    
    comparisonHistory.unshift(historyItem);
    if (comparisonHistory.length > 5) comparisonHistory.pop();
    saveHistory();
    updateHistoryDisplay();
}

function updateHistoryDisplay() {
    const container = $('#comparisonHistory');
    if (!container.length) return;
    
    if (comparisonHistory.length === 0) {
        container.html('<p class="text-white-50 mb-0">Todavía no has comparado ninguna skin.</p>');
        return;
    }
    
    let html = '';
    comparisonHistory.forEach(item => {
        html += `
            <div class="history-item" onclick="reloadComparison('${item.skin1Id}', '${item.skin2Id}')">
                <i class="bi bi-arrow-left-right"></i> ${item.skin1Name} vs ${item.skin2Name}
                <small class="text-white-50 ms-2">${item.date}</small>
            </div>
        `;
    });
    container.html(html);
}

function reloadComparison(skin1Id, skin2Id) {
    playSound('click');
    if (skin1Id) $('#skinSelect1').val(skin1Id).trigger('change');
    if (skin2Id) $('#skinSelect2').val(skin2Id).trigger('change');
    showToast('Comparación cargada', 'Revisa los detalles', 'select');
}

// --------------------------------------------------------------
// ANIMACIÓN ASCII
// --------------------------------------------------------------
function initAsciiAnimation() {
    $('#vsIcon').click(function() {
        if (!currentSkin1 || !currentSkin2) {
            showToast('¡Selecciona dos skins!', 'Elige una skin para cada lado', 'click');
            return;
        }
        
        playSound('select');
        
        const asciiFrames = [
            "⚔️ PELEA ÉPICA ⚔️\n\n" + currentSkin1.name + "  VS  " + currentSkin2.name + "\n\n" +
            "    ╔═══════════╗\n" +
            "    ║   FIGHT!  ║\n" +
            "    ╚═══════════╝",
            
            "🔥 " + currentSkin1.name + " lanza un ataque crítico!\n" +
            "💥 " + currentSkin2.name + " contraataca!\n" +
            "✨ ¡El combate continúa! ✨",
            
            "🏆 ¡VICTORIA ROYALE! 🏆\n\n" +
            "El ganador es: " + (Math.random() > 0.5 ? currentSkin1.name : currentSkin2.name)
        ];
        
        let frame = 0;
        const asciiContainer = $('#asciiAnimation');
        const asciiArt = $('.ascii-art');
        
        asciiContainer.show();
        asciiArt.text(asciiFrames[frame]);
        
        const interval = setInterval(() => {
            frame++;
            if (frame < asciiFrames.length) {
                asciiArt.text(asciiFrames[frame]);
            } else {
                clearInterval(interval);
                setTimeout(() => asciiContainer.fadeOut(500), 1500);
            }
        }, 1500);
    });
}

// --------------------------------------------------------------
// FAVORITOS
// --------------------------------------------------------------
function toggleFavorite(skinId, skinName, skinImage, skinRarity, skinType, event) {
    playSound('like', 0.15);
    
    const btn = $(event?.currentTarget);
    const icon = btn.find('i');
    const rect = btn[0].getBoundingClientRect();
    createSparkles(rect.left + rect.width/2, rect.top + rect.height/2);
    
    const index = favorites.findIndex(f => f.id === skinId);
    if (index === -1) {
        favorites.push({ id: skinId, name: skinName, image: skinImage, rarity: skinRarity, type: skinType });
        icon.removeClass('bi-heart').addClass('bi-heart-fill');
        showToast('❤️ Añadido a favoritos', skinName, 'notification');
    } else {
        favorites.splice(index, 1);
        icon.removeClass('bi-heart-fill').addClass('bi-heart');
        showToast('💔 Eliminado de favoritos', skinName, 'notification');
    }
    saveFavorites();
    updateAllFavoriteButtons();
    updateFavoritesDisplay();
    updateFavoritesPreview();
    updateCompareFavoritesList();
}

function updateAllFavoriteButtons() {
    $('.favorite-btn').each(function() {
        const skinId = $(this).data('id');
        const isFav = favorites.some(f => f.id === skinId);
        const icon = $(this).find('i');
        if (isFav) {
            icon.removeClass('bi-heart').addClass('bi-heart-fill');
        } else {
            icon.removeClass('bi-heart-fill').addClass('bi-heart');
        }
    });
}

function isFavorite(skinId) {
    return favorites.some(f => f.id === skinId);
}

function updateFavoritesDisplay() {
    if ($('#favoritesContainer').length === 0) return;
    
    if (favorites.length === 0) {
        $('#favoritesContainer').html(`<div class="col-12 text-center"><div class="empty-favorites"><i class="bi bi-heart fs-1 mb-3 d-block"></i><p>No tienes skins favoritas aún.</p><p class="small">Haz clic en el ❤️ de cualquier skin para guardarla aquí.</p></div></div>`);
        return;
    }
    
    let html = '';
    favorites.forEach(fav => {
        const rarityClass = getRarityClassFromName(fav.rarity);
        html += `<div class="col-lg-3 col-md-4 col-sm-6"><div class="cosmetic-card"><button class="favorite-btn" data-id="${fav.id}" onclick="toggleFavorite('${fav.id}', '${escapeHtml(fav.name)}', '${fav.image}', '${fav.rarity}', '${fav.type}', event)"><i class="bi bi-heart-fill"></i></button><img src="${fav.image}" alt="${escapeHtml(fav.name)}" loading="lazy"><div class="card-body"><h5 class="card-title">${escapeHtml(fav.name)}</h5><span class="rarity-badge ${rarityClass}">${fav.rarity || 'Común'}</span><p class="small text-white-50 mt-1">${fav.type || 'Cosmético'}</p></div></div></div>`;
    });
    $('#favoritesContainer').html(html);
}

function updateFavoritesPreview() {
    if ($('#favoritesPreview').length === 0) return;
    if (favorites.length === 0) {
        $('#favoritesPreview').html('<div class="text-center py-4 text-white-50"><i class="bi bi-heart fs-1"></i><p class="mt-2">No hay favoritos aún</p><small>Haz clic en ❤️ en cualquier skin</small></div>');
        return;
    }
    let html = '';
    favorites.slice(0, 3).forEach(fav => {
        html += `<div class="trending-preview-item"><img src="${fav.image}" alt="${escapeHtml(fav.name)}"><div class="trending-info"><div class="trending-name">${escapeHtml(fav.name)}</div><div class="trending-rank">⭐ Favorito</div></div></div>`;
    });
    if (favorites.length > 3) html += `<div class="text-center mt-2 text-white-50 small">+${favorites.length - 3} más</div>`;
    $('#favoritesPreview').html(html);
}

function updateCompareFavoritesList() {
    if ($('#compareFavoritesList').length === 0) return;
    if (favorites.length === 0) {
        $('#compareFavoritesList').html('<div class="text-center py-4 text-white-50"><i class="bi bi-heart fs-1"></i><p class="mt-2">No tienes favoritos aún</p><small>Haz clic en ❤️ en cualquier skin para guardarla</small></div>');
        return;
    }
    let html = '';
    favorites.forEach(fav => {
        const rarityClass = getRarityClassFromName(fav.rarity);
        html += `<div class="favorite-item" onclick="selectFavoriteForCompare('${fav.id}', '${escapeHtml(fav.name)}', '${fav.image}', '${fav.rarity}', '${fav.type}')">
            <img src="${fav.image}" alt="${escapeHtml(fav.name)}">
            <div class="fav-name">${escapeHtml(fav.name)}</div>
            <span class="fav-rarity ${rarityClass}">${fav.rarity || 'Común'}</span>
            <i class="bi bi-arrow-right-circle text-neon ms-2"></i>
        </div>`;
    });
    $('#compareFavoritesList').html(html);
}

// --------------------------------------------------------------
// COMPARADOR DE SKINS MEJORADO (CON BÚSQUEDA Y ORDENACIÓN)
// --------------------------------------------------------------

// Variables adicionales para el comparador mejorado
let currentFilter1 = '';
let currentFilter2 = '';
let currentSort1 = 'default';
let currentSort2 = 'default';

function loadSkinsForCompare() {
    $('#skinSelect1, #skinSelect2').html('<option value="">Cargando skins...</option>');
    
    $.ajax({
        url: API_URL,
        method: 'GET',
        success: function(response) {
            let allItems = [];
            if (response?.data) {
                if (Array.isArray(response.data)) allItems = response.data;
                else if (response.data.br) allItems = response.data.br;
                else if (response.data.items?.br) allItems = response.data.items.br;
            }
            allSkinsList = allItems.filter(item => item.type?.value === 'outfit');
            
            allSkinsList.sort((a, b) => a.name.localeCompare(b.name));
            window.originalSkinsList = [...allSkinsList];
            
            updateSelectOptions('skinSelect1', allSkinsList, currentFilter1, currentSort1);
            updateSelectOptions('skinSelect2', allSkinsList, currentFilter2, currentSort2);
            
            setupCompareSearchAndSort();
            
            console.log(`Cargadas ${allSkinsList.length} skins para el comparador`);
        },
        error: function() {
            $('#skinSelect1, #skinSelect2').html('<option value="">Error al cargar skins</option>');
        }
    });
}

function updateSelectOptions(selectId, skinsList, filterText, sortOrder) {
    let filteredSkins = [...skinsList];
    
    if (filterText) {
        filteredSkins = filteredSkins.filter(skin => 
            skin.name.toLowerCase().includes(filterText.toLowerCase())
        );
    }
    
    switch(sortOrder) {
        case 'asc':
            filteredSkins.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'desc':
            filteredSkins.sort((a, b) => b.name.localeCompare(a.name));
            break;
        default:
            filteredSkins.sort((a, b) => a.name.localeCompare(b.name));
            break;
    }
    
    let options = '<option value="">Selecciona una skin...</option>';
    
    if (filterText && filteredSkins.length === 0) {
        options += '<option disabled>❌ No se encontraron skins</option>';
    } else if (filterText) {
        options += `<option disabled style="background: var(--neon-cyan); color: #000;">🔍 ${filteredSkins.length} resultados encontrados</option>`;
    }
    
    filteredSkins.forEach(skin => {
        options += `<option value="${skin.id}">${escapeHtml(skin.name)}</option>`;
    });
    
    $(`#${selectId}`).html(options);
    
    if (filterText) {
        $(`#${selectId}`).css('border-color', 'var(--neon-cyan)');
        setTimeout(() => $(`#${selectId}`).css('border-color', ''), 500);
    }
}

function setupCompareSearchAndSort() {
    $('#searchSkin1').off('input').on('input', function() {
        currentFilter1 = $(this).val();
        updateSelectOptions('skinSelect1', allSkinsList, currentFilter1, currentSort1);
        playSound('select');
    });
    
    $('#sortAlpha1').off('click').on('click', function() {
        currentSort1 = 'asc';
        updateSelectOptions('skinSelect1', allSkinsList, currentFilter1, currentSort1);
        playSound('click');
        showToast('Ordenado A-Z', 'Lista ordenada alfabéticamente', 'select');
    });
    
    $('#sortReverse1').off('click').on('click', function() {
        currentSort1 = 'desc';
        updateSelectOptions('skinSelect1', allSkinsList, currentFilter1, currentSort1);
        playSound('click');
        showToast('Ordenado Z-A', 'Lista ordenada inversamente', 'select');
    });
    
    $('#searchSkin2').off('input').on('input', function() {
        currentFilter2 = $(this).val();
        updateSelectOptions('skinSelect2', allSkinsList, currentFilter2, currentSort2);
        playSound('select');
    });
    
    $('#sortAlpha2').off('click').on('click', function() {
        currentSort2 = 'asc';
        updateSelectOptions('skinSelect2', allSkinsList, currentFilter2, currentSort2);
        playSound('click');
        showToast('Ordenado A-Z', 'Lista ordenada alfabéticamente', 'select');
    });
    
    $('#sortReverse2').off('click').on('click', function() {
        currentSort2 = 'desc';
        updateSelectOptions('skinSelect2', allSkinsList, currentFilter2, currentSort2);
        playSound('click');
        showToast('Ordenado Z-A', 'Lista ordenada inversamente', 'select');
    });
    
    $('#skinSelect1').off('change').on('change', function() {
        const skinId = $(this).val();
        if (skinId) {
            currentSkin1 = allSkinsList.find(s => s.id === skinId);
            updateSkinPreview('skinPreview1', currentSkin1, 'skin1');
            updateComparisonDetails();
            playSound('select');
        } else {
            currentSkin1 = null;
            resetPreview('skinPreview1', 'skin1');
            updateComparisonDetails();
        }
    });
    
    $('#skinSelect2').off('change').on('change', function() {
        const skinId = $(this).val();
        if (skinId) {
            currentSkin2 = allSkinsList.find(s => s.id === skinId);
            updateSkinPreview('skinPreview2', currentSkin2, 'skin2');
            updateComparisonDetails();
            playSound('select');
        } else {
            currentSkin2 = null;
            resetPreview('skinPreview2', 'skin2');
            updateComparisonDetails();
        }
    });
}

function updateSkinPreview(containerId, skin, side) {
    if (!skin) return;
    const imgUrl = skin.images?.icon || 'https://placehold.co/400x400/1a1a2e/00f3ff?text=No+Img';
    const rarityClass = getRarityClass(skin.rarity?.value);
    const isFav = isFavorite(skin.id);
    
    const html = `
        <img src="${imgUrl}" alt="${escapeHtml(skin.name)}" class="img-fluid rounded-3" style="max-height: 200px;">
        <h5 class="mt-2">${escapeHtml(skin.name)}</h5>
        <span class="rarity-badge ${rarityClass}">${skin.rarity?.displayValue || 'Común'}</span>
    `;
    $(`#${containerId}`).html(html);
    
    const favBtn = side === 'skin1' ? $('#favBtn1') : $('#favBtn2');
    
    if (favBtn.parent().attr('id') !== containerId) {
        $(`#${containerId}`).append(favBtn);
    }
    
    favBtn.data('skin-id', skin.id);
    favBtn.data('skin-name', skin.name);
    favBtn.data('skin-image', imgUrl);
    favBtn.data('skin-rarity', skin.rarity?.displayValue || 'Común');
    favBtn.data('skin-type', getTypeDisplay(skin.type?.value));
    
    favBtn.off('click').on('click', function(e) {
        e.stopPropagation();
        const id = $(this).data('skin-id');
        const name = $(this).data('skin-name');
        const image = $(this).data('skin-image');
        const rarity = $(this).data('skin-rarity');
        const type = $(this).data('skin-type');
        toggleFavorite(id, name, image, rarity, type, e);
        const isNowFav = isFavorite(id);
        const icon = $(this).find('i');
        if (isNowFav) {
            icon.removeClass('bi-heart').addClass('bi-heart-fill');
        } else {
            icon.removeClass('bi-heart-fill').addClass('bi-heart');
        }
    });
    
    favBtn.show();
    
    const icon = favBtn.find('i');
    if (isFav) {
        icon.removeClass('bi-heart').addClass('bi-heart-fill');
    } else {
        icon.removeClass('bi-heart-fill').addClass('bi-heart');
    }
}

function resetPreview(containerId, side) {
    $(`#${containerId}`).html(`
        <img src="https://placehold.co/300x300/1a1a2e/00f3ff?text=Selecciona+una+skin" alt="Sin selección" class="img-fluid rounded-3" style="max-height: 200px;">
        <p class="mt-2 text-white-50">Selecciona una skin para comparar</p>
    `);
    const favBtn = side === 'skin1' ? $('#favBtn1') : $('#favBtn2');
    $(`#${containerId}`).append(favBtn);
    favBtn.hide();
}

function updateComparisonDetails() {
    if (currentSkin1) {
        $('#detailName1').text(currentSkin1.name || 'Sin nombre');
        $('#detailRarity1').html(`<span class="rarity-badge ${getRarityClass(currentSkin1.rarity?.value)}">${currentSkin1.rarity?.displayValue || 'Común'}</span>`);
        $('#detailType1').text(getTypeDisplay(currentSkin1.type?.value));
        $('#detailSeason1').text(getSkinSeason(currentSkin1));
        $('#detailDesc1').text(currentSkin1.description || 'No hay descripción disponible');
    } else {
        $('#detailName1').text('---');
        $('#detailRarity1').text('---');
        $('#detailType1').text('---');
        $('#detailSeason1').text('---');
        $('#detailDesc1').text('Selecciona una skin para ver sus detalles');
    }
    
    if (currentSkin2) {
        $('#detailName2').text(currentSkin2.name || 'Sin nombre');
        $('#detailRarity2').html(`<span class="rarity-badge ${getRarityClass(currentSkin2.rarity?.value)}">${currentSkin2.rarity?.displayValue || 'Común'}</span>`);
        $('#detailType2').text(getTypeDisplay(currentSkin2.type?.value));
        $('#detailSeason2').text(getSkinSeason(currentSkin2));
        $('#detailDesc2').text(currentSkin2.description || 'No hay descripción disponible');
    } else {
        $('#detailName2').text('---');
        $('#detailRarity2').text('---');
        $('#detailType2').text('---');
        $('#detailSeason2').text('---');
        $('#detailDesc2').text('Selecciona una skin para ver sus detalles');
    }
    
    if (currentSkin1 && currentSkin2) {
        $('.vs-icon').addClass('vs-active');
        addToHistory(currentSkin1, currentSkin2);
    } else {
        $('.vs-icon').removeClass('vs-active');
    }
}

function initRandomForSkin1() {
    $('#randomSkin1Btn').off('click').on('click', function() {
        playSound('click');
        if (allSkinsList.length === 0) {
            showToast('Cargando skins', 'Espera un momento', 'click');
            return;
        }
        const randomSkin = allSkinsList[Math.floor(Math.random() * allSkinsList.length)];
        $('#skinSelect1').val(randomSkin.id).trigger('change');
        $('#searchSkin1').val('');
        currentFilter1 = '';
        currentSort1 = 'default';
        updateSelectOptions('skinSelect1', allSkinsList, '', 'default');
        showToast('Skin aleatoria cargada', randomSkin.name, 'select');
    });
}

function initRandomForSkin2() {
    $('#randomSkin2Btn').off('click').on('click', function() {
        playSound('click');
        if (allSkinsList.length === 0) {
            showToast('Cargando skins', 'Espera un momento', 'click');
            return;
        }
        const randomSkin = allSkinsList[Math.floor(Math.random() * allSkinsList.length)];
        $('#skinSelect2').val(randomSkin.id).trigger('change');
        $('#searchSkin2').val('');
        currentFilter2 = '';
        currentSort2 = 'default';
        updateSelectOptions('skinSelect2', allSkinsList, '', 'default');
        showToast('Skin aleatoria cargada', randomSkin.name, 'select');
    });
}

function initDeselectButtons() {
    $('#deselectSkin1Btn').off('click').on('click', function() {
        playSound('click');
        $('#skinSelect1').val('').trigger('change');
        $('#searchSkin1').val('');
        currentFilter1 = '';
        currentSort1 = 'default';
        updateSelectOptions('skinSelect1', allSkinsList, '', 'default');
        showToast('Skin 1 deseleccionada', 'Puedes elegir otra', 'click');
    });
    
    $('#deselectSkin2Btn').off('click').on('click', function() {
        playSound('click');
        $('#skinSelect2').val('').trigger('change');
        $('#searchSkin2').val('');
        currentFilter2 = '';
        currentSort2 = 'default';
        updateSelectOptions('skinSelect2', allSkinsList, '', 'default');
        showToast('Skin 2 deseleccionada', 'Puedes elegir otra', 'click');
    });
}

function selectFavoriteForCompare(id, name, image, rarity, type) {
    playSound('click');
    const skin = allSkinsList.find(s => s.id === id);
    if (!skin) {
        if (!$('#skinSelect1').val()) {
            $('#skinSelect1').val(id).trigger('change');
            showToast('Skin 1 actualizada', name);
        } else if (!$('#skinSelect2').val()) {
            $('#skinSelect2').val(id).trigger('change');
            showToast('Skin 2 actualizada', name);
        } else {
            showToast('Ya tienes dos skins seleccionadas', 'Puedes cambiar una desde los selects', 'click');
        }
        return;
    }
    
    if (!$('#skinSelect1').val()) {
        $('#skinSelect1').val(id).trigger('change');
        showToast('Skin 1 actualizada', name);
    } else if (!$('#skinSelect2').val()) {
        $('#skinSelect2').val(id).trigger('change');
        showToast('Skin 2 actualizada', name);
    } else {
        showToast('Ya tienes dos skins seleccionadas', 'Puedes cambiar una desde los selects', 'click');
    }
}

// --------------------------------------------------------------
// MODO OSCURO / CLARO
// --------------------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem('fortnite-theme');
    if (savedTheme === 'light') {
        $('body').addClass('light-mode');
        $('#themeToggle i').removeClass('bi-moon-stars-fill').addClass('bi-sun-fill');
    } else {
        $('body').removeClass('light-mode');
        $('#themeToggle i').removeClass('bi-sun-fill').addClass('bi-moon-stars-fill');
    }
}

function toggleTheme() {
    playSound('click');
    if ($('body').hasClass('light-mode')) {
        $('body').removeClass('light-mode');
        localStorage.setItem('fortnite-theme', 'dark');
        $('#themeToggle i').removeClass('bi-sun-fill').addClass('bi-moon-stars-fill');
    } else {
        $('body').addClass('light-mode');
        localStorage.setItem('fortnite-theme', 'light');
        $('#themeToggle i').removeClass('bi-moon-stars-fill').addClass('bi-sun-fill');
    }
}

// --------------------------------------------------------------
// FILTROS DE LA TIENDA
// --------------------------------------------------------------
function initFilterToggles() {
    $('.btn-filter-toggle').click(function() {
        playSound('click');
        const targetGroup = $(this).data('filter-group');
        $('.btn-filter-toggle').removeClass('active');
        $(this).addClass('active');
        $('.filter-group').hide();
        $(`#filter-${targetGroup}`).show();
    });
}

// --------------------------------------------------------------
// MODALES
// --------------------------------------------------------------
function showSkinModal(skin) {
    try {
        playSound('select');
        $('#skinModalTitle').text(skin.name || 'Sin nombre');
        $('#skinModalImg').attr('src', skin.images?.icon || 'https://placehold.co/400x400/1a1a2e/00f3ff?text=No+Img');
        $('#skinModalDesc').text(skin.description || 'No hay descripción disponible');
        const rarityClass = getRarityClass(skin.rarity?.value);
        $('#skinModalRarity').html(`<span class="rarity-badge ${rarityClass}">${skin.rarity?.displayValue || 'Común'}</span>`);
        $('#skinModalType').text(getTypeDisplay(skin.type?.value));
        new bootstrap.Modal($('#skinModal')[0]).show();
    } catch(e) { console.error('Error modal skin:', e); }
}

function showNewsModal(title, body, imageUrl) {
    try {
        playSound('click');
        $('#newsModalTitle').text(title);
        $('#newsModalBody').html(`<div class="text-center"><img src="${imageUrl}" alt="${title}" class="img-fluid rounded mb-3" style="max-height: 200px;"><p class="mt-3">${body}</p><hr class="border-neon"><small class="text-white-50">Fuente: Fortnite-API.com</small></div>`);
        new bootstrap.Modal($('#newsModal')[0]).show();
    } catch(e) { console.error('Error modal noticia:', e); }
}

// --------------------------------------------------------------
// ESTADÍSTICAS DE LA LANDING
// --------------------------------------------------------------
let statsAnimated = false;
let targetStats = { skins: 0, emotes: 0, total: 0 };

function loadStats() {
    $('#skinsCount, #emotesCount, #totalCount').text('---');
    
    $.ajax({
        url: API_URL,
        method: 'GET',
        success: function(response) {
            let allItems = [];
            if (response?.data) {
                if (Array.isArray(response.data)) allItems = response.data;
                else if (response.data.br) allItems = response.data.br;
                else if (response.data.items?.br) allItems = response.data.items.br;
            }
            if (allItems.length > 0) {
                targetStats.skins = allItems.filter(item => item.type?.value === 'outfit').length;
                targetStats.emotes = allItems.filter(item => item.type?.value === 'emote').length;
                targetStats.total = allItems.length;
                
                console.log(`Estadísticas cargadas: ${targetStats.skins} skins, ${targetStats.emotes} emotes, ${targetStats.total} items`);
                checkAndAnimateStats();
            } else {
                targetStats.skins = 1247;
                targetStats.emotes = 856;
                targetStats.total = 3420;
                checkAndAnimateStats();
            }
        },
        error: function() {
            targetStats.skins = 1247;
            targetStats.emotes = 856;
            targetStats.total = 3420;
            checkAndAnimateStats();
        }
    });
}

function isStatsSectionVisible() {
    const statsSection = document.getElementById('stats');
    if (!statsSection) return false;
    
    const rect = statsSection.getBoundingClientRect();
    const windowHeight = window.innerHeight || document.documentElement.clientHeight;
    const threshold = 0.3;
    const elementVisible = rect.top < windowHeight - (windowHeight * (1 - threshold)) && rect.bottom > 0;
    
    return elementVisible;
}

function animateSingleNumber(element, target, duration = 2000) {
    if (!element || !target) return;
    
    const start = 0;
    const startTime = performance.now();
    
    const updateNumber = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(start + (target - start) * easeOut);
        
        element.textContent = currentValue.toLocaleString('es-ES');
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        } else {
            element.textContent = target.toLocaleString('es-ES');
            element.style.transform = 'scale(1.05)';
            setTimeout(() => {
                if (element) element.style.transform = '';
            }, 200);
        }
    };
    
    requestAnimationFrame(updateNumber);
}

function animateAllCounters() {
    if (statsAnimated) return;
    statsAnimated = true;
    
    const skinsElement = document.getElementById('skinsCount');
    const emotesElement = document.getElementById('emotesCount');
    const totalElement = document.getElementById('totalCount');
    
    $('.stat-number').addClass('counter-animating');
    
    animateSingleNumber(skinsElement, targetStats.skins, 2000);
    animateSingleNumber(emotesElement, targetStats.emotes, 2000);
    animateSingleNumber(totalElement, targetStats.total, 2000);
    
    setTimeout(() => {
        $('.stat-number').removeClass('counter-animating');
    }, 2100);
    
    console.log('Animación de contadores iniciada');
}

function checkAndAnimateStats() {
    if (statsAnimated) return;
    if (targetStats.skins === 0 && targetStats.emotes === 0 && targetStats.total === 0) return;
    
    if (isStatsSectionVisible()) {
        animateAllCounters();
    }
}

$(window).on('scroll', function() {
    checkAndAnimateStats();
});

setTimeout(checkAndAnimateStats, 500);

// --------------------------------------------------------------
// NOTICIAS
// --------------------------------------------------------------
const loadingMessages = ["Saltando del autobús...", "Recargando armas...", "Construyendo rampas...", "Abriendo un cofre...", "Tomando escudo de Slurp...", "Buscando loot...", "Preparando victoria...", "Conectando con la isla...", "Invocando grieta..."];
function getRandomLoadingMessage() { return loadingMessages[Math.floor(Math.random() * loadingMessages.length)]; }

function loadNews() {
    const loadingMsg = getRandomLoadingMessage();
    $('#newsContainer').html(`<div class="col-12 text-center"><div class="spinner-border text-neon"></div><p class="mt-2 text-white-50">${loadingMsg}</p></div>`);
    $.ajax({
        url: NEWS_URL,
        method: 'GET',
        success: function(response) {
            if (response?.data?.motds) {
                const newsItems = response.data.motds.filter(n => !n.hidden).slice(0, 6);
                displayNews(newsItems);
            } else {
                $('#newsContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay noticias disponibles</div></div>');
            }
        },
        error: () => $('#newsContainer').html('<div class="col-12 text-center"><div class="alert alert-danger">Error al cargar noticias</div></div>')
    });
}

function displayNews(newsItems) {
    if (!newsItems || newsItems.length === 0) {
        $('#newsContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay noticias disponibles</div></div>');
        return;
    }
    let html = '';
    newsItems.forEach((news, index) => {
        let colClass = index === 0 ? 'col-12' : 'col-md-6 col-sm-12';
        const imageUrl = news.tileImage || news.image || 'https://placehold.co/720x400/1a1a2e/00f3ff?text=Noticia';
        html += `<div class="${colClass}" data-aos="fade-up" data-aos-delay="${(index % 3) * 100}"><div class="news-card h-100"><div class="news-image"><img src="${imageUrl}" alt="${escapeHtml(news.title)}" loading="lazy"></div><div class="news-body"><h3 class="news-title">${escapeHtml(news.title)}</h3><p class="news-description">${escapeHtml(news.body.substring(0, 120))}...</p><div class="news-footer"><span class="news-date"><i class="bi bi-calendar-event"></i> ${new Date().toLocaleDateString('es-ES')}</span><a href="#" class="news-read-more" data-title="${escapeHtml(news.title)}" data-body="${escapeHtml(news.body)}" data-image="${imageUrl}">Leer más <i class="bi bi-arrow-right-short"></i></a></div></div></div></div>`;
    });
    $('#newsContainer').html(html);
    if (typeof AOS !== 'undefined') AOS.refresh();
    $('.news-read-more').off('click').on('click', function(e) {
        e.preventDefault();
        showNewsModal($(this).data('title'), $(this).data('body'), $(this).data('image'));
    });
}

function initCountdown() {
    const eventDate = new Date('June 15, 2026 00:00:00').getTime();
    function updateCountdown() {
        const now = new Date().getTime();
        const distance = eventDate - now;
        if (distance > 0) {
            $('#days').text(String(Math.floor(distance / (1000*60*60*24))).padStart(2,'0'));
            $('#hours').text(String(Math.floor((distance % (1000*60*60*24)) / (1000*60*60))).padStart(2,'0'));
            $('#minutes').text(String(Math.floor((distance % (1000*60*60)) / (1000*60))).padStart(2,'0'));
            $('#seconds').text(String(Math.floor((distance % (1000*60)) / 1000)).padStart(2,'0'));
        } else {
            $('.countdown-timer').html('<div class="text-center"><h3 class="text-neon">¡EL EVENTO YA COMENZÓ!</h3></div>');
        }
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function loadTrending() {
    $.ajax({
        url: SHOP_URL,
        method: 'GET',
        success: function(response) {
            if (response?.data?.entries) {
                let shopItems = [];
                response.data.entries.forEach(entry => {
                    if (entry.brItems && entry.brItems.length > 0) {
                        shopItems = shopItems.concat(entry.brItems);
                    }
                });
                const uniqueItems = [];
                const ids = new Set();
                for (const item of shopItems) {
                    if (!ids.has(item.id) && item.type?.value === 'outfit') {
                        ids.add(item.id);
                        uniqueItems.push(item);
                    }
                }
                displayTrending(uniqueItems.slice(0, 12));
                console.log(`Tendencias cargadas: ${uniqueItems.length} skins`);
            } else {
                $('#trendingContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay tendencias disponibles</div></div>');
            }
        },
        error: () => $('#trendingContainer').html('<div class="col-12 text-center"><div class="alert alert-danger">Error al cargar tendencias</div></div>')
    });
}

function displayTrending(items) {
    if (!items || items.length === 0) {
        $('#trendingContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay tendencias disponibles</div></div>');
        return;
    }
    let html = '';
    items.forEach((item, index) => {
        const rarityClass = getRarityClass(item.rarity?.value);
        const imgUrl = item.images?.icon || 'https://placehold.co/400x400/1a1a2e/00f3ff?text=No+Img';
        const isFav = isFavorite(item.id);
        html += `<div class="col-lg-3 col-md-4 col-sm-6"><div class="cosmetic-card"><div class="trending-badge"><i class="bi bi-fire"></i> #${index + 1}</div><button class="favorite-btn" data-id="${item.id}" onclick="toggleFavorite('${item.id}', '${escapeHtml(item.name)}', '${imgUrl}', '${item.rarity?.displayValue || 'Común'}', '${getTypeDisplay(item.type?.value)}', event)"><i class="bi ${isFav ? 'bi-heart-fill' : 'bi-heart'}"></i></button><img src="${imgUrl}" alt="${escapeHtml(item.name)}" loading="lazy"><div class="card-body"><h5 class="card-title">${escapeHtml(item.name)}</h5><span class="rarity-badge ${rarityClass}">${item.rarity?.displayValue || 'Común'}</span><p class="small text-white-50 mt-1">${getTypeDisplay(item.type?.value)}</p></div></div></div>`;
    });
    $('#trendingContainer').html(html);
}

// --------------------------------------------------------------
// TIENDA
// --------------------------------------------------------------
function loadShopCosmetics() {
    const loadingMsg = getRandomLoadingMessage();
    $('#cosmeticsContainer').html(`<div class="col-12 text-center"><div class="spinner-border text-neon"></div><p class="mt-2 text-white-50">${loadingMsg}</p></div>`);
    $.ajax({
        url: SHOP_URL,
        method: 'GET',
        success: function(response) {
            if (response?.data?.entries) {
                let shopItems = [];
                response.data.entries.forEach(entry => {
                    if (entry.brItems && entry.brItems.length > 0) {
                        shopItems = shopItems.concat(entry.brItems);
                    }
                });
                const uniqueItems = [];
                const ids = new Set();
                for (const item of shopItems) {
                    if (!ids.has(item.id)) {
                        ids.add(item.id);
                        uniqueItems.push(item);
                    }
                }
                allShopItems = uniqueItems;
                renderIsotopeGrid(allShopItems.slice(0, 60));
                setupFilters();
                setupSearch();
                updateResultsCount();
                console.log(`Tienda cargada: ${allShopItems.length} cosméticos`);
            } else {
                $('#cosmeticsContainer').html('<div class="alert alert-danger">No se encontraron cosméticos</div>');
            }
        },
        error: () => $('#cosmeticsContainer').html('<div class="alert alert-danger">Error de conexión</div>')
    });
}

function renderIsotopeGrid(items) {
    if (!items || items.length === 0) {
        $('#cosmeticsContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay cosméticos</div></div>');
        $('#resultsCount').html('<span class="badge bg-neon">0 resultados</span>');
        return;
    }
    let html = '';
    items.forEach(item => {
        const rarityClass = getRarityClass(item.rarity?.value);
        const typeValue = item.type?.value || 'other';
        const imgUrl = item.images?.icon || 'https://placehold.co/400x400/1a1a2e/00f3ff?text=No+Img';
        const isFav = isFavorite(item.id);
        html += `<div class="col-lg-3 col-md-4 col-sm-6 isotope-item ${rarityClass.replace('rarity-', '')} ${typeValue}"><div class="cosmetic-card"><button class="favorite-btn" data-id="${item.id}" onclick="toggleFavorite('${item.id}', '${escapeHtml(item.name)}', '${imgUrl}', '${item.rarity?.displayValue || 'Común'}', '${getTypeDisplay(item.type?.value)}', event)"><i class="bi ${isFav ? 'bi-heart-fill' : 'bi-heart'}"></i></button><img src="${imgUrl}" alt="${escapeHtml(item.name)}" loading="lazy"><div class="card-body"><h5 class="card-title">${escapeHtml(item.name) || '???'}</h5><span class="rarity-badge ${rarityClass}">${item.rarity?.displayValue || 'Común'}</span><p class="small text-white-50 mt-1">${getTypeDisplay(item.type?.value)}</p></div></div></div>`;
    });
    $('#cosmeticsContainer').html(html);
    if (isotopeInstance) isotopeInstance.destroy();
    isotopeInstance = new Isotope('#cosmeticsContainer', { itemSelector: '.isotope-item', layoutMode: 'fitRows', transitionDuration: '0.6s' });
    applyCombinedFilter();
    updateResultsCount();
}

function updateResultsCount() {
    const visibleCount = $('.isotope-item:visible').length;
    $('#resultsCount').html(`<span class="badge bg-neon">${visibleCount} de ${allShopItems.length} cosméticos</span>`);
}

function getTypeDisplay(typeValue) {
    const types = { 'outfit': '🎭 Skin', 'emote': '💃 Emote', 'backpack': '🎒 Mochila', 'pickaxe': '⛏️ Pico', 'glider': '🪂 Ala', 'wrap': '🎨 Envoltura', 'other': '📦 Otro' };
    return types[typeValue] || `📦 ${typeValue || 'Cosmético'}`;
}

function setupFilters() {
    $('.rarity-buttons .filter-btn').click(function() {
        playSound('click');
        currentRarityFilter = $(this).data('filter');
        $('.rarity-buttons .filter-btn').removeClass('active');
        $(this).addClass('active');
        applyCombinedFilter();
    });
    $('.type-buttons .filter-btn').click(function() {
        playSound('click');
        currentTypeFilter = $(this).data('type');
        $('.type-buttons .filter-btn').removeClass('active');
        $(this).addClass('active');
        applyCombinedFilter();
    });
}

function applyCombinedFilter() {
    let filterString = '';
    if (currentRarityFilter !== '*' && currentTypeFilter !== '*') filterString = `${currentRarityFilter}.${currentTypeFilter}`;
    else if (currentRarityFilter !== '*') filterString = currentRarityFilter;
    else if (currentTypeFilter !== '*') filterString = `.${currentTypeFilter}`;
    else filterString = '*';
    isotopeInstance.arrange({ filter: filterString });
    setTimeout(updateResultsCount, 100);
}

function setupSearch() {
    $('#searchBtn').click(function() {
        playSound('click');
        const term = $('#searchInput').val().toLowerCase();
        if (!term) { renderIsotopeGrid(allShopItems.slice(0, 60)); return; }
        renderIsotopeGrid(allShopItems.filter(c => c.name?.toLowerCase().includes(term)).slice(0, 60));
    });
    $('#searchInput').keypress(e => { if (e.which === 13) $('#searchBtn').click(); });
}

// --------------------------------------------------------------
// FUNCIONES AUXILIARES
// --------------------------------------------------------------
function getRarityClass(rarity) {
    const rarities = { 'common': 'rarity-common', 'uncommon': 'rarity-uncommon', 'rare': 'rarity-rare', 'epic': 'rarity-epic', 'legendary': 'rarity-legendary', 'starwars': 'rarity-legendary', 'icon': 'rarity-epic', 'slurp': 'rarity-epic' };
    return rarities[rarity] || 'rarity-common';
}

function getRarityClassFromName(rarityName) {
    const map = { 'Legendario': 'rarity-legendary', 'Épico': 'rarity-epic', 'Raro': 'rarity-rare', 'Poco común': 'rarity-uncommon', 'Común': 'rarity-common' };
    return map[rarityName] || 'rarity-common';
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function setCurrentYear() { $('#currentYear').text(new Date().getFullYear()); }

// --------------------------------------------------------------
// TRUCOS Y CONSEJOS
// --------------------------------------------------------------
const fortniteTips = [
    "💥 Apunta a la cabeza: el daño crítico es mucho mayor.",
    "🏗️ Construye siempre rampas para tener ventaja sobre tus enemigos.",
    "🎁 Los cofres siempre están en los mismos lugares, ¡aprende sus spawns!",
    "🏃‍♂️ Escucha los pasos: el sonido es clave para saber dónde están.",
    "🧠 El escudo de Slurp se regenera con el tiempo.",
    "🔫 La pistola de hielo congela a los enemigos y los ralentiza.",
    "👥 Comunícate con tu equipo, es la clave del éxito.",
    "📅 Los eventos en vivo dan recompensas exclusivas.",
    "🔊 Usa auriculares para escuchar los pasos de los enemigos.",
    "💨 El humo de las granadas puede cubrir tu escape.",
    "🪂 Si sales del autobús tarde, llegarás más lejos.",
    "🎯 Las mejoras de armas se encuentran en cofres de alto nivel."
];

function showRandomTip() { $('#currentTip').text(fortniteTips[Math.floor(Math.random() * fortniteTips.length)]); }

// --------------------------------------------------------------
// EFECTOS VISUALES
// --------------------------------------------------------------
function initScrollProgress() {
    $(window).scroll(function() {
        const scrolled = ($(document).scrollTop() / ($(document).height() - $(window).height())) * 100;
        $('.scroll-progress').css('width', scrolled + '%');
    });
}

function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    type();
}

$('body').on('mouseenter', '.btn, .cosmetic-card, .news-card, .stat-card, .slider-card, .favorite-btn, .filter-btn, .btn-filter-toggle, .favorite-item', function() { playHover(); });

// --------------------------------------------------------------
// LÍNEA DEL TIEMPO DE MAPAS
// --------------------------------------------------------------
const timelineData = [
    { titulo: "CAPÍTULO 1", años: "2017-2019", tag: "ATHENA", desc: "El mapa original donde todo comenzó.", lugares: ["Parque Placentero", "Ciudad Comercio", "Balsa Botín"], img: "https://static.wikia.nocookie.net/fortnite/images/7/75/Athena_%28Update_v2.4.2%29_-_Island_-_Fortnite.png/revision/latest/scale-to-width-down/1200?cb=20231016205139" },
    { titulo: "CAPÍTULO 2", años: "2019-2021", tag: "APOLLO", desc: "Nuevo mapa con islas, barcos y zonas acuáticas.", lugares: ["La Agencia", "Albercas Adormecidas", "Yate de Midas"], img: "https://static.wikia.nocookie.net/fortnite/images/0/08/Apollo_%28Update_v12.60%29_-_Island_-_Fortnite.png/revision/latest?cb=20231009212156" },
    { titulo: "CAPÍTULO 3", años: "2021-2022", tag: "ARTEMIS", desc: "La isla se dio la vuelta con nuevas ubicaciones.", lugares: ["Santuario", "Daily Bugle", "Ciudad Cromo"], img: "https://static.wikia.nocookie.net/fortnite/images/4/4b/Artemis_%28Update_v21.00%29_-_Island_-_Fortnite.png/revision/latest?cb=20231010092654" },
    { titulo: "CAPÍTULO 4", años: "2022-2023", tag: "ASTERIA", desc: "Una isla futurista con castillos medievales y tecnología avanzada.", lugares: ["Castillo Slone", "Bastión Brutal", "Ciudad MEGA"], img: "https://www.gamerevolution.com/wp-content/uploads/sites/2/2023/03/Fortnite-Chapter-4-Season-2-Map-Changes-2.jpg?w=1024" },
    { titulo: "CAPÍTULO 5", años: "2023-2024", tag: "HELIOS", desc: "Un mapa inspirado en el espionaje y la mitología griega.", lugares: ["El Inframundo", "Carretes Conservados", "Monte Olimpo"], img: "https://static.wikia.nocookie.net/fortnite/images/2/21/Helios_%28Update_v28.00%29_-_Island_-_Fortnite.png/revision/latest?cb=20231206212959" },
    { titulo: "CAPÍTULO 6", años: "2024-2025", tag: "ONINOSHIMA", desc: "Armas elementales y espíritus ancestrales.", lugares: ["Dojo Demoníaco", "Cruce Cañon", "Templo Templaza"], img: "https://static.wikia.nocookie.net/fortnite/images/d/d3/Oninoshima_%28Update_v33.00%29_-_Island_-_Fortnite.png/revision/latest?cb=20241201072954" }
];

function initTimeline() {
    const container = document.getElementById('timelineContainer');
    if (!container) return;
    
    let html = '';
    timelineData.forEach(mapa => {
        let badges = '';
        mapa.lugares.forEach(lugar => { badges += `<span class="timeline-badge">${lugar}</span>`; });
        
        html += `
            <div class="timeline-item">
                <div class="timeline-card" onclick="abrirModalMapa('${mapa.titulo}', '${mapa.desc.replace(/'/g, "\\'")}', '${mapa.img}')">
                    <img src="${mapa.img}" class="timeline-img" alt="${mapa.titulo}" onerror="this.src='https://placehold.co/600x400/1a1a2e/00f3ff?text=Mapa'">
                    <div class="timeline-content">
                        <span class="timeline-year">${mapa.años}</span>
                        <h3 class="timeline-title">${mapa.titulo}</h3>
                        <div class="timeline-tag">${mapa.tag}</div>
                        <p class="timeline-desc">${mapa.desc}</p>
                        <div class="timeline-badges">${badges}</div>
                        <button class="btn-timeline" onclick="event.stopPropagation(); abrirModalMapa('${mapa.titulo}', '${mapa.desc.replace(/'/g, "\\'")}', '${mapa.img}')"><i class="bi bi-eye"></i> Ver mapa completo</button>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
    }, { threshold: 0.3 });
    document.querySelectorAll('.timeline-item').forEach(item => observer.observe(item));
}

// --------------------------------------------------------------
// FUNCIONES DE MAPAS (QUIZ, NAVEGACIÓN, MODAL)
// --------------------------------------------------------------

// Variables para el quiz
let currentQuizIndex = 0;
let quizAnswered = false;

// Preguntas del quiz
const quizQuestions = [
    { poi: "Parque Placentero", correctChapter: 0, options: ["Capítulo 1", "Capítulo 2", "Capítulo 3"] },
    { poi: "La Agencia", correctChapter: 1, options: ["Capítulo 1", "Capítulo 2", "Capítulo 3"] },
    { poi: "Daily Bugle", correctChapter: 2, options: ["Capítulo 2", "Capítulo 3", "Capítulo 4"] },
    { poi: "Ciudad MEGA", correctChapter: 3, options: ["Capítulo 3", "Capítulo 4", "Capítulo 5"] },
    { poi: "Monte Olimpo", correctChapter: 4, options: ["Capítulo 4", "Capítulo 5", "Capítulo 6"] },
    { poi: "Dojo Demoníaco", correctChapter: 5, options: ["Capítulo 5", "Capítulo 6", "Capítulo 4"] }
];

// Vídeos por capítulo para el modal (ACTUALIZADOS)
const chapterVideos = {
    'CAPÍTULO 1': 'WJW-bzXZM8M',
    'CAPÍTULO 2': 'i6lR2s-0EU0',
    'CAPÍTULO 3': '0BI6wPEJSDo',
    'CAPÍTULO 4': 'JW-KIbV9PRU',
    'CAPÍTULO 5': '1XcgbOAkRIQ',
    'CAPÍTULO 6': 'LrfzND9Dgq8'
};

function abrirModalMapa(titulo, descripcion, imagen) {
    try {
        if (typeof playSound === 'function') playSound('select');
        
        const videoId = chapterVideos[titulo] || 'kgbIecfhjlg';
        
        document.getElementById('mapModalTitle').innerText = titulo;
        document.getElementById('mapModalImg').src = imagen;
        document.getElementById('mapModalVideo').src = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
        document.getElementById('mapModalDesc').innerHTML = descripcion;
        
        const modalElement = document.getElementById('mapModal');
        modalElement.addEventListener('hidden.bs.modal', function() {
            document.getElementById('mapModalVideo').src = '';
        }, { once: true });
        
        new bootstrap.Modal(modalElement).show();
    } catch(e) { 
        alert(titulo + '\n\n' + descripcion); 
    }
}

function loadQuizQuestion() {
    if (currentQuizIndex >= quizQuestions.length) {
        currentQuizIndex = 0;
    }
    const q = quizQuestions[currentQuizIndex];
    $('#quizQuestion').text(`¿En qué capítulo apareció "${q.poi}"?`);
    
    let optionsHtml = '';
    q.options.forEach(opt => {
        const isCorrect = (opt === `Capítulo ${q.correctChapter + 1}`);
        optionsHtml += `<div class="quiz-option" data-correct="${isCorrect}" data-chapter-name="${opt}">${opt}</div>`;
    });
    $('#quizOptions').html(optionsHtml);
    $('#quizResult').html('').removeClass('correct-result wrong-result');
    quizAnswered = false;
    
    $('.quiz-option').off('click').on('click', function() {
        if (quizAnswered) return;
        
        const isCorrect = $(this).data('correct') === true;
        const selectedChapter = $(this).data('chapter-name');
        const correctChapter = `Capítulo ${quizQuestions[currentQuizIndex].correctChapter + 1}`;
        
        quizAnswered = true;
        
        if (isCorrect) {
            $(this).addClass('correct');
            $('#quizResult').html(`✅ ¡Correcto! ${quizQuestions[currentQuizIndex].poi} apareció en el ${selectedChapter}`).addClass('correct-result');
            playSound('like');
            if (typeof showToast === 'function') showToast('🎉 Respuesta correcta', quizQuestions[currentQuizIndex].poi + ' es del ' + correctChapter, 'select');
        } else {
            $(this).addClass('wrong');
            $('#quizResult').html(`❌ Incorrecto. ${quizQuestions[currentQuizIndex].poi} apareció en el ${correctChapter}`).addClass('wrong-result');
            playSound('click');
            $('.quiz-option').each(function() {
                if ($(this).data('correct') === true) {
                    $(this).addClass('correct');
                }
            });
        }
        
        $('.quiz-option').addClass('disabled');
        
        setTimeout(() => {
            currentQuizIndex++;
            loadQuizQuestion();
        }, 2500);
    });
}

function initMapsPage() {
    loadQuizQuestion();
    
    $(document).on('mouseenter', '.timeline-card', function() {
        if (typeof playHover === 'function') playHover();
    });
}

window.abrirModalMapa = abrirModalMapa;

// --------------------------------------------------------------
// INICIO DE LA PÁGINA
// --------------------------------------------------------------
$(document).ready(function() {
    console.log('Fortnite Hub iniciado');
    
    initTheme();
    $('#themeToggle').click(toggleTheme);
    initFilterToggles();
    setCurrentYear();
    initScrollProgress();
    if (document.getElementById('typed-title')) typeWriter(document.getElementById('typed-title'), 'EL UNIVERSO FORTNITE', 100);
    $('#newTipBtn').click(function() { playSound('click'); showRandomTip(); });
    showRandomTip();
    updateFavoritesDisplay();
    updateFavoritesPreview();
    
    $('#backToTop').click(() => $('html, body').animate({ scrollTop: 0 }, 500));
    
    $('a[href^="#"]').on('click', function(e) {
        const target = $(this.getAttribute('href'));
        if (target.length) {
            e.preventDefault();
            $('html, body').animate({ scrollTop: target.offset().top - 70 }, 800);
        }
    });
    
    const currentPage = window.location.pathname;
    if (currentPage.includes('shop.html')) {
        console.log('Página: Tienda');
        loadShopCosmetics();
    } else if (currentPage.includes('compare.html')) {
        console.log('Página: Comparador');
        loadSkinsForCompare();
        initRandomForSkin1();
        initRandomForSkin2();
        initDeselectButtons();
        initAsciiAnimation();
        updateHistoryDisplay();
        updateCompareFavoritesList();
    } else if (currentPage.includes('maps.html')) {
        console.log('Página: Línea del tiempo de mapas');
        initTimeline();
        initMapsPage();
    } else {
        console.log('Página: Inicio');
        loadStats();
        loadNews();
        initCountdown();
        loadTrending();
    }
    
    window.toggleFavorite = toggleFavorite;
    window.selectFavoriteForCompare = selectFavoriteForCompare;
    window.showSkinModal = showSkinModal;
    window.reloadComparison = reloadComparison;
});