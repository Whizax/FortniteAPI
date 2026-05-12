// --------------------------------------------------------------
// VARIABLES GLOBALES
// --------------------------------------------------------------
const API_URL = 'https://fortnite-api.com/v2/cosmetics';
const SHOP_URL = 'https://fortnite-api.com/v2/shop';
const NEWS_URL = 'https://fortnite-api.com/v2/news/br';
const BANNERS_URL = 'https://fortnite-api.com/v1/banners';

let allCosmetics = [];
let allShopItems = [];
let isotopeInstance = null;
let currentRarityFilter = '*';
let currentTypeFilter = '*';

// Variables para el comparador
let allSkinsList = [];
let currentSkin1 = null;
let currentSkin2 = null;

// Favoritos
let favorites = JSON.parse(localStorage.getItem('fortniteFavorites')) || [];
let comparisonHistory = JSON.parse(localStorage.getItem('fortniteHistory')) || [];

// Variables para banners
let allBanners = [];
let currentBannerFilter = 'all';
let displayedBannersCount = 24;

// Variables para estadísticas
let statsAnimated = false;
let statsData = { skins: 1847, emotes: 1256, total: 8420 };

// --------------------------------------------------------------
// FUNCIONES DE UTILIDAD
// --------------------------------------------------------------
function saveFavorites() {
    localStorage.setItem('fortniteFavorites', JSON.stringify(favorites));
}

function saveHistory() {
    localStorage.setItem('fortniteHistory', JSON.stringify(comparisonHistory));
}

function setCurrentYear() { 
    $('#currentYear').text(new Date().getFullYear()); 
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

function playHover() { playSound('hover', 0.05); }

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
// RAREZA Y TIPOS
// --------------------------------------------------------------
function getRarityClass(rarity) {
    const rarities = { 'common': 'rarity-common', 'uncommon': 'rarity-uncommon', 'rare': 'rarity-rare', 'epic': 'rarity-epic', 'legendary': 'rarity-legendary', 'starwars': 'rarity-legendary', 'icon': 'rarity-epic', 'slurp': 'rarity-epic' };
    return rarities[rarity] || 'rarity-common';
}

function getRarityClassFromName(rarityName) {
    const map = { 'Legendario': 'rarity-legendary', 'Épico': 'rarity-epic', 'Raro': 'rarity-rare', 'Poco común': 'rarity-uncommon', 'Común': 'rarity-common' };
    return map[rarityName] || 'rarity-common';
}

function getTypeDisplay(typeValue) {
    const types = { 'outfit': '🎭 Skin', 'emote': '💃 Emote', 'backpack': '🎒 Mochila', 'pickaxe': '⛏️ Pico', 'glider': '🪂 Ala', 'wrap': '🎨 Envoltura', 'other': '📦 Otro' };
    return types[typeValue] || `📦 ${typeValue || 'Cosmético'}`;
}

function getSkinSeason(skin) {
    if (skin.introduction) {
        const intro = skin.introduction;
        if (intro.chapter && intro.season) return `Capítulo ${intro.chapter}, Temporada ${intro.season}`;
        if (intro.text) return intro.text;
    }
    if (skin.added) {
        const date = new Date(skin.added);
        return `Añadido: ${date.toLocaleDateString('es-ES')}`;
    }
    return 'Temporada desconocida';
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
        showToast('❤️ Añadido a favoritos', skinName);
    } else {
        favorites.splice(index, 1);
        icon.removeClass('bi-heart-fill').addClass('bi-heart');
        showToast('💔 Eliminado de favoritos', skinName);
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
        if (isFav) icon.removeClass('bi-heart').addClass('bi-heart-fill');
        else icon.removeClass('bi-heart-fill').addClass('bi-heart');
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
// HISTORIAL DE COMPARACIONES
// --------------------------------------------------------------
function addToHistory(skin1, skin2) {
    if (!skin1 || !skin2) return;
    const historyItem = { id: Date.now(), skin1Name: skin1.name, skin2Name: skin2.name, skin1Id: skin1.id, skin2Id: skin2.id, date: new Date().toLocaleString() };
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
        html += `<div class="history-item" onclick="reloadComparison('${item.skin1Id}', '${item.skin2Id}')"><i class="bi bi-arrow-left-right"></i> ${item.skin1Name} vs ${item.skin2Name}<small class="text-white-50 ms-2">${item.date}</small></div>`;
    });
    container.html(html);
}

function reloadComparison(skin1Id, skin2Id) {
    playSound('click');
    if (skin1Id) $('#skinSelect1').val(skin1Id).trigger('change');
    if (skin2Id) $('#skinSelect2').val(skin2Id).trigger('change');
    showToast('Comparación cargada', 'Revisa los detalles');
}

// --------------------------------------------------------------
// COMPARADOR
// --------------------------------------------------------------
let currentFilter1 = '', currentFilter2 = '', currentSort1 = 'default', currentSort2 = 'default';

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
            
            let options = '<option value="">Selecciona una skin...</option>';
            allSkinsList.forEach(skin => { options += `<option value="${skin.id}">${escapeHtml(skin.name)}</option>`; });
            $('#skinSelect1, #skinSelect2').html(options);
            
            setupCompareSearchAndSort();
            console.log(`Cargadas ${allSkinsList.length} skins para el comparador`);
        },
        error: () => $('#skinSelect1, #skinSelect2').html('<option value="">Error al cargar skins</option>')
    });
}

function updateSelectOptions(selectId, filterText, sortOrder) {
    let filteredSkins = [...allSkinsList];
    if (filterText) filteredSkins = filteredSkins.filter(skin => skin.name.toLowerCase().includes(filterText.toLowerCase()));
    if (sortOrder === 'asc') filteredSkins.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortOrder === 'desc') filteredSkins.sort((a, b) => b.name.localeCompare(a.name));
    
    let options = '<option value="">Selecciona una skin...</option>';
    if (filterText && filteredSkins.length === 0) options += '<option disabled>❌ No se encontraron skins</option>';
    else if (filterText) options += `<option disabled style="background: var(--neon-cyan); color: #000;">🔍 ${filteredSkins.length} resultados</option>`;
    
    filteredSkins.forEach(skin => { options += `<option value="${skin.id}">${escapeHtml(skin.name)}</option>`; });
    $(`#${selectId}`).html(options);
}

function setupCompareSearchAndSort() {
    $('#searchSkin1').on('input', function() { currentFilter1 = $(this).val(); updateSelectOptions('skinSelect1', currentFilter1, currentSort1); playSound('select'); });
    $('#sortAlpha1').on('click', function() { currentSort1 = 'asc'; updateSelectOptions('skinSelect1', currentFilter1, currentSort1); showToast('Ordenado A-Z', 'Lista ordenada alfabéticamente'); });
    $('#sortReverse1').on('click', function() { currentSort1 = 'desc'; updateSelectOptions('skinSelect1', currentFilter1, currentSort1); showToast('Ordenado Z-A', 'Lista ordenada inversamente'); });
    $('#searchSkin2').on('input', function() { currentFilter2 = $(this).val(); updateSelectOptions('skinSelect2', currentFilter2, currentSort2); playSound('select'); });
    $('#sortAlpha2').on('click', function() { currentSort2 = 'asc'; updateSelectOptions('skinSelect2', currentFilter2, currentSort2); showToast('Ordenado A-Z'); });
    $('#sortReverse2').on('click', function() { currentSort2 = 'desc'; updateSelectOptions('skinSelect2', currentFilter2, currentSort2); showToast('Ordenado Z-A'); });
    
    $('#skinSelect1').on('change', function() {
        const skinId = $(this).val();
        if (skinId) { currentSkin1 = allSkinsList.find(s => s.id === skinId); updateSkinPreview('skinPreview1', currentSkin1, 'skin1'); updateComparisonDetails(); playSound('select'); }
        else { currentSkin1 = null; resetPreview('skinPreview1', 'skin1'); updateComparisonDetails(); }
    });
    $('#skinSelect2').on('change', function() {
        const skinId = $(this).val();
        if (skinId) { currentSkin2 = allSkinsList.find(s => s.id === skinId); updateSkinPreview('skinPreview2', currentSkin2, 'skin2'); updateComparisonDetails(); playSound('select'); }
        else { currentSkin2 = null; resetPreview('skinPreview2', 'skin2'); updateComparisonDetails(); }
    });
}

function updateSkinPreview(containerId, skin, side) {
    if (!skin) return;
    const imgUrl = skin.images?.icon || 'https://placehold.co/400x400/1a1a2e/00f3ff?text=No+Img';
    const rarityClass = getRarityClass(skin.rarity?.value);
    const isFav = isFavorite(skin.id);
    const favBtn = side === 'skin1' ? $('#favBtn1') : $('#favBtn2');
    
    $(`#${containerId}`).html(`<img src="${imgUrl}" alt="${escapeHtml(skin.name)}" class="img-fluid rounded-3" style="max-height: 200px;"><h5 class="mt-2">${escapeHtml(skin.name)}</h5><span class="rarity-badge ${rarityClass}">${skin.rarity?.displayValue || 'Común'}</span>`);
    $(`#${containerId}`).append(favBtn);
    favBtn.data('skin-id', skin.id).data('skin-name', skin.name).data('skin-image', imgUrl).data('skin-rarity', skin.rarity?.displayValue || 'Común').data('skin-type', getTypeDisplay(skin.type?.value));
    favBtn.off('click').on('click', function(e) { e.stopPropagation(); toggleFavorite($(this).data('skin-id'), $(this).data('skin-name'), $(this).data('skin-image'), $(this).data('skin-rarity'), $(this).data('skin-type'), e); });
    favBtn.show();
    const icon = favBtn.find('i');
    if (isFav) icon.removeClass('bi-heart').addClass('bi-heart-fill');
    else icon.removeClass('bi-heart-fill').addClass('bi-heart');
}

function resetPreview(containerId, side) {
    $(`#${containerId}`).html(`<img src="https://placehold.co/300x300/1a1a2e/00f3ff?text=Selecciona+una+skin" alt="Sin selección" class="img-fluid rounded-3" style="max-height: 200px;"><p class="mt-2 text-white-50">Selecciona una skin para comparar</p>`);
    const favBtn = side === 'skin1' ? $('#favBtn1') : $('#favBtn2');
    $(`#${containerId}`).append(favBtn);
    favBtn.hide();
}

function updateComparisonDetails() {
    if (currentSkin1) {
        $('#detailName1').text(currentSkin1.name);
        $('#detailRarity1').html(`<span class="rarity-badge ${getRarityClass(currentSkin1.rarity?.value)}">${currentSkin1.rarity?.displayValue || 'Común'}</span>`);
        $('#detailType1').text(getTypeDisplay(currentSkin1.type?.value));
        $('#detailSeason1').text(getSkinSeason(currentSkin1));
        $('#detailDesc1').text(currentSkin1.description || 'No hay descripción');
    } else {
        $('#detailName1,#detailRarity1,#detailType1,#detailSeason1').text('---');
        $('#detailDesc1').text('Selecciona una skin');
    }
    if (currentSkin2) {
        $('#detailName2').text(currentSkin2.name);
        $('#detailRarity2').html(`<span class="rarity-badge ${getRarityClass(currentSkin2.rarity?.value)}">${currentSkin2.rarity?.displayValue || 'Común'}</span>`);
        $('#detailType2').text(getTypeDisplay(currentSkin2.type?.value));
        $('#detailSeason2').text(getSkinSeason(currentSkin2));
        $('#detailDesc2').text(currentSkin2.description || 'No hay descripción');
    } else {
        $('#detailName2,#detailRarity2,#detailType2,#detailSeason2').text('---');
        $('#detailDesc2').text('Selecciona una skin');
    }
    if (currentSkin1 && currentSkin2) { $('.vs-icon').addClass('vs-active'); addToHistory(currentSkin1, currentSkin2); }
    else { $('.vs-icon').removeClass('vs-active'); }
}

function initRandomForSkin1() {
    $('#randomSkin1Btn').on('click', function() {
        playSound('click');
        if (!allSkinsList.length) { showToast('Cargando skins', 'Espera un momento'); return; }
        const randomSkin = allSkinsList[Math.floor(Math.random() * allSkinsList.length)];
        $('#skinSelect1').val(randomSkin.id).trigger('change');
        $('#searchSkin1').val('');
        currentFilter1 = ''; currentSort1 = 'default';
        updateSelectOptions('skinSelect1', '', 'default');
        showToast('Skin aleatoria cargada', randomSkin.name);
    });
}

function initRandomForSkin2() {
    $('#randomSkin2Btn').on('click', function() {
        playSound('click');
        if (!allSkinsList.length) { showToast('Cargando skins', 'Espera un momento'); return; }
        const randomSkin = allSkinsList[Math.floor(Math.random() * allSkinsList.length)];
        $('#skinSelect2').val(randomSkin.id).trigger('change');
        $('#searchSkin2').val('');
        currentFilter2 = ''; currentSort2 = 'default';
        updateSelectOptions('skinSelect2', '', 'default');
        showToast('Skin aleatoria cargada', randomSkin.name);
    });
}

function initDeselectButtons() {
    $('#deselectSkin1Btn').on('click', function() { playSound('click'); $('#skinSelect1').val('').trigger('change'); $('#searchSkin1').val(''); currentFilter1 = ''; currentSort1 = 'default'; updateSelectOptions('skinSelect1', '', 'default'); showToast('Skin 1 deseleccionada', 'Puedes elegir otra'); });
    $('#deselectSkin2Btn').on('click', function() { playSound('click'); $('#skinSelect2').val('').trigger('change'); $('#searchSkin2').val(''); currentFilter2 = ''; currentSort2 = 'default'; updateSelectOptions('skinSelect2', '', 'default'); showToast('Skin 2 deseleccionada', 'Puedes elegir otra'); });
}

function selectFavoriteForCompare(id, name, image, rarity, type) {
    playSound('click');
    if (!$('#skinSelect1').val()) { $('#skinSelect1').val(id).trigger('change'); showToast('Skin 1 actualizada', name); }
    else if (!$('#skinSelect2').val()) { $('#skinSelect2').val(id).trigger('change'); showToast('Skin 2 actualizada', name); }
    else { showToast('Ya tienes dos skins', 'Puedes cambiar una desde los selects'); }
}

function initAsciiAnimation() {
    $('#vsIcon').on('click', function() {
        if (!currentSkin1 || !currentSkin2) { showToast('¡Selecciona dos skins!', 'Elige una skin para cada lado'); return; }
        playSound('select');
        const asciiFrames = [
            "⚔️ PELEA ÉPICA ⚔️\n\n" + currentSkin1.name + "  VS  " + currentSkin2.name + "\n\n    ╔═══════════╗\n    ║   FIGHT!  ║\n    ╚═══════════╝",
            "🔥 " + currentSkin1.name + " lanza un ataque crítico!\n💥 " + currentSkin2.name + " contraataca!\n✨ ¡El combate continúa! ✨",
            "🏆 ¡VICTORIA ROYALE! 🏆\n\nEl ganador es: " + (Math.random() > 0.5 ? currentSkin1.name : currentSkin2.name)
        ];
        let frame = 0;
        const asciiContainer = $('#asciiAnimation');
        const asciiArt = $('.ascii-art');
        asciiContainer.show();
        asciiArt.text(asciiFrames[frame]);
        const interval = setInterval(() => {
            frame++;
            if (frame < asciiFrames.length) asciiArt.text(asciiFrames[frame]);
            else { clearInterval(interval); setTimeout(() => asciiContainer.fadeOut(500), 1500); }
        }, 1500);
    });
}

// --------------------------------------------------------------
// ESTADÍSTICAS DE LA LANDING (CORREGIDAS)
// --------------------------------------------------------------

function loadStats() {
    $('#skinsCount, #emotesCount, #totalCount').text('---');
    
    // Datos reales aproximados de Fortnite (valores de respaldo)
    statsData = { skins: 1847, emotes: 1256, total: 8420 };
    
    // Intentar obtener datos reales de la API
    $.ajax({
        url: API_URL,
        method: 'GET',
        timeout: 5000,
        success: function(response) {
            let allItems = [];
            if (response?.data) {
                if (Array.isArray(response.data)) allItems = response.data;
                else if (response.data.br && Array.isArray(response.data.br)) allItems = response.data.br;
                else if (response.data.items?.br && Array.isArray(response.data.items.br)) allItems = response.data.items.br;
                else {
                    for (let key in response.data) {
                        if (Array.isArray(response.data[key]) && response.data[key].length > 100) {
                            allItems = response.data[key];
                            break;
                        }
                    }
                }
            }
            if (allItems.length > 0) {
                const skins = allItems.filter(item => item.type?.value === 'outfit' || item.type === 'outfit').length;
                const emotes = allItems.filter(item => item.type?.value === 'emote' || item.type === 'emote').length;
                statsData = { skins: skins, emotes: emotes, total: allItems.length };
                console.log(`✅ Estadísticas cargadas: ${skins} skins, ${emotes} emotes, ${allItems.length} items`);
            }
            startStatsAnimation();
        },
        error: function() {
            console.log('📊 Usando valores de respaldo para estadísticas');
            startStatsAnimation();
        }
    });
}

function startStatsAnimation() {
    if (statsAnimated) return;
    statsAnimated = true;
    
    animateNumber('skinsCount', statsData.skins);
    animateNumber('emotesCount', statsData.emotes);
    animateNumber('totalCount', statsData.total);
}

function animateNumber(elementId, target) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let current = 0;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current += increment;
        if (step >= steps) {
            clearInterval(timer);
            element.textContent = target.toLocaleString('es-ES');
            element.style.transform = 'scale(1.05)';
            setTimeout(() => { element.style.transform = ''; }, 200);
        } else {
            element.textContent = Math.floor(current).toLocaleString('es-ES');
        }
    }, duration / steps);
}

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
            } else { $('#newsContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay noticias</div></div>'); }
        },
        error: () => $('#newsContainer').html('<div class="col-12 text-center"><div class="alert alert-danger">Error al cargar noticias</div></div>')
    });
}

function displayNews(newsItems) {
    if (!newsItems || newsItems.length === 0) { $('#newsContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay noticias</div></div>'); return; }
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

function showNewsModal(title, body, imageUrl) {
    playSound('click');
    $('#newsModalTitle').text(title);
    $('#newsModalBody').html(`<div class="text-center"><img src="${imageUrl}" alt="${title}" class="img-fluid rounded mb-3" style="max-height: 200px;"><p class="mt-3">${body}</p><hr class="border-neon"><small class="text-white-50">Fuente: Fortnite-API.com</small></div>`);
    new bootstrap.Modal($('#newsModal')[0]).show();
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
        } else { $('.countdown-timer').html('<div class="text-center"><h3 class="text-neon">¡EL EVENTO YA COMENZÓ!</h3></div>'); }
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
                    if (entry.brItems && entry.brItems.length > 0) shopItems = shopItems.concat(entry.brItems);
                });
                const uniqueItems = [];
                const ids = new Set();
                for (const item of shopItems) {
                    if (!ids.has(item.id) && item.type?.value === 'outfit') { ids.add(item.id); uniqueItems.push(item); }
                }
                displayTrending(uniqueItems.slice(0, 12));
                console.log(`Tendencias: ${uniqueItems.length} skins`);
            } else { $('#trendingContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay tendencias</div></div>'); }
        },
        error: () => $('#trendingContainer').html('<div class="col-12 text-center"><div class="alert alert-danger">Error en tendencias</div></div>')
    });
}

function displayTrending(items) {
    if (!items || items.length === 0) { $('#trendingContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay tendencias</div></div>'); return; }
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
                    if (entry.brItems && entry.brItems.length > 0) shopItems = shopItems.concat(entry.brItems);
                });
                const uniqueItems = [];
                const ids = new Set();
                for (const item of shopItems) { if (!ids.has(item.id)) { ids.add(item.id); uniqueItems.push(item); } }
                allShopItems = uniqueItems;
                renderIsotopeGrid(allShopItems.slice(0, 60));
                setupFilters();
                setupSearch();
                updateResultsCount();
                console.log(`Tienda cargada: ${allShopItems.length} cosméticos`);
            } else { $('#cosmeticsContainer').html('<div class="alert alert-danger">No se encontraron cosméticos</div>'); }
        },
        error: () => $('#cosmeticsContainer').html('<div class="alert alert-danger">Error de conexión</div>')
    });
}

function renderIsotopeGrid(items) {
    if (!items || items.length === 0) { $('#cosmeticsContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay cosméticos</div></div>'); $('#resultsCount').html('<span class="badge bg-neon">0 resultados</span>'); return; }
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

function updateResultsCount() { $('#resultsCount').html(`<span class="badge bg-neon">${$('.isotope-item:visible').length} de ${allShopItems.length} cosméticos</span>`); }

function setupFilters() {
    $('.rarity-buttons .filter-btn').on('click', function() { playSound('click'); currentRarityFilter = $(this).data('filter'); $('.rarity-buttons .filter-btn').removeClass('active'); $(this).addClass('active'); applyCombinedFilter(); });
    $('.type-buttons .filter-btn').on('click', function() { playSound('click'); currentTypeFilter = $(this).data('type'); $('.type-buttons .filter-btn').removeClass('active'); $(this).addClass('active'); applyCombinedFilter(); });
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
    $('#searchBtn').on('click', function() { playSound('click'); const term = $('#searchInput').val().toLowerCase(); if (!term) { renderIsotopeGrid(allShopItems.slice(0, 60)); return; } renderIsotopeGrid(allShopItems.filter(c => c.name?.toLowerCase().includes(term)).slice(0, 60)); });
    $('#searchInput').on('keypress', e => { if (e.which === 13) $('#searchBtn').click(); });
}

function initFilterToggles() {
    $('.btn-filter-toggle').on('click', function() { playSound('click'); const targetGroup = $(this).data('filter-group'); $('.btn-filter-toggle').removeClass('active'); $(this).addClass('active'); $('.filter-group').hide(); $(`#filter-${targetGroup}`).show(); });
}

// --------------------------------------------------------------
// MODALES
// --------------------------------------------------------------
function showSkinModal(skin) {
    playSound('select');
    $('#skinModalTitle').text(skin.name || 'Sin nombre');
    $('#skinModalImg').attr('src', skin.images?.icon || 'https://placehold.co/400x400/1a1a2e/00f3ff?text=No+Img');
    $('#skinModalDesc').text(skin.description || 'No hay descripción');
    const rarityClass = getRarityClass(skin.rarity?.value);
    $('#skinModalRarity').html(`<span class="rarity-badge ${rarityClass}">${skin.rarity?.displayValue || 'Común'}</span>`);
    $('#skinModalType').text(getTypeDisplay(skin.type?.value));
    new bootstrap.Modal($('#skinModal')[0]).show();
}

// --------------------------------------------------------------
// BANNERS (GALERÍA)
// --------------------------------------------------------------
function loadBanners() {
    $('#bannersContainer').html('<div class="col-12 text-center"><div class="spinner-border text-neon"></div><p class="mt-2 text-white-50">Cargando banners...</p></div>');
    $.ajax({
        url: BANNERS_URL,
        method: 'GET',
        success: function(response) {
            if (response?.data && Array.isArray(response.data)) {
                allBanners = response.data;
                $('#bannerCount').text(`${allBanners.length} BANNERS DISPONIBLES`);
                displayBanners(allBanners.slice(0, displayedBannersCount));
                setupBannerFilters();
                if (allBanners.length > displayedBannersCount) $('#loadMoreBannersBtn').show();
                console.log(`✅ ${allBanners.length} banners cargados`);
            } else { $('#bannersContainer').html('<div class="col-12 text-center"><div class="alert alert-danger">No se pudieron cargar los banners</div></div>'); }
        },
        error: () => $('#bannersContainer').html('<div class="col-12 text-center"><div class="alert alert-danger">Error al cargar los banners</div></div>')
    });
}

function displayBanners(banners) {
    if (!banners || banners.length === 0) { $('#bannersContainer').html('<div class="col-12 text-center"><div class="alert alert-info">No hay banners con ese filtro</div></div>'); return; }
    let html = '';
    banners.forEach(banner => {
        const imgUrl = banner.images?.icon || banner.images?.smallIcon || 'https://placehold.co/400x200/1a1a2e/00f3ff?text=Banner';
        const category = banner.category || 'BattleRoyale';
        const categoryClass = category === 'Special' ? '✨ Especial' : '🎮 Battle Royale';
        html += `<div class="col-lg-3 col-md-4 col-sm-6 banner-item" data-category="${category}"><div class="banner-card" onclick="openBannerModal('${imgUrl}', '${escapeHtml(banner.name)}', '${categoryClass}')"><img src="${imgUrl}" alt="${escapeHtml(banner.name)}" class="banner-img" loading="lazy"><div class="banner-info"><h5 class="banner-name">${escapeHtml(banner.name)}</h5><span class="banner-category">${categoryClass}</span></div></div></div>`;
    });
    $('#bannersContainer').html(html);
}

function setupBannerFilters() {
    $('.banner-filter-btn').on('click', function() {
        const filter = $(this).data('filter');
        currentBannerFilter = filter;
        $('.banner-filter-btn').removeClass('active');
        $(this).addClass('active');
        let filteredBanners = [...allBanners];
        if (filter !== 'all') filteredBanners = filteredBanners.filter(b => b.category === filter);
        displayedBannersCount = 24;
        if (filteredBanners.length > displayedBannersCount) $('#loadMoreBannersBtn').show();
        else $('#loadMoreBannersBtn').hide();
        displayBanners(filteredBanners.slice(0, displayedBannersCount));
    });
}

function loadMoreBanners() {
    if (typeof playSound === 'function') playSound('click');
    let sourceBanners = allBanners;
    if (currentBannerFilter !== 'all') sourceBanners = allBanners.filter(b => b.category === currentBannerFilter);
    displayedBannersCount += 24;
    displayBanners(sourceBanners.slice(0, displayedBannersCount));
    if (displayedBannersCount >= sourceBanners.length) $('#loadMoreBannersBtn').hide();
}

function openBannerModal(imgUrl, name, category) {
    if (typeof playSound === 'function') playSound('select');
    if ($('#bannerModal').length === 0) {
        $('body').append(`<div class="modal fade" id="bannerModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content bg-dark text-white"><div class="modal-header border-neon"><h5 class="modal-title text-neon" id="bannerModalTitle"></h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body text-center"><img id="bannerModalImg" src="" alt="" class="img-fluid rounded" style="max-height: 60vh;"><div class="mt-3"><span id="bannerModalCategory" class="banner-category"></span></div><p class="mt-2 text-white-50">Banner oficial de Fortnite</p></div><div class="modal-footer border-neon"><button class="btn btn-outline-custom" data-bs-dismiss="modal">Cerrar</button></div></div></div></div>`);
    }
    $('#bannerModalTitle').text(name);
    $('#bannerModalImg').attr('src', imgUrl);
    $('#bannerModalCategory').text(category);
    new bootstrap.Modal($('#bannerModal')[0]).show();
}

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
        html += `<div class="timeline-item"><div class="timeline-card" onclick="abrirModalMapa('${mapa.titulo}', '${mapa.desc.replace(/'/g, "\\'")}', '${mapa.img}')"><img src="${mapa.img}" class="timeline-img" alt="${mapa.titulo}" onerror="this.src='https://placehold.co/600x400/1a1a2e/00f3ff?text=Mapa'"><div class="timeline-content"><span class="timeline-year">${mapa.años}</span><h3 class="timeline-title">${mapa.titulo}</h3><div class="timeline-tag">${mapa.tag}</div><p class="timeline-desc">${mapa.desc}</p><div class="timeline-badges">${badges}</div><button class="btn-timeline" onclick="event.stopPropagation(); abrirModalMapa('${mapa.titulo}', '${mapa.desc.replace(/'/g, "\\'")}', '${mapa.img}')"><i class="bi bi-eye"></i> Ver mapa completo</button></div></div></div>`;
    });
    container.innerHTML = html;
    const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); }); }, { threshold: 0.3 });
    document.querySelectorAll('.timeline-item').forEach(item => observer.observe(item));
}

// Variables para el quiz de mapas
let currentQuizIndex = 0;
let quizAnswered = false;
const quizQuestions = [
    { poi: "Parque Placentero", correctChapter: 0, options: ["Capítulo 1", "Capítulo 2", "Capítulo 3"] },
    { poi: "La Agencia", correctChapter: 1, options: ["Capítulo 1", "Capítulo 2", "Capítulo 3"] },
    { poi: "Daily Bugle", correctChapter: 2, options: ["Capítulo 2", "Capítulo 3", "Capítulo 4"] },
    { poi: "Ciudad MEGA", correctChapter: 3, options: ["Capítulo 3", "Capítulo 4", "Capítulo 5"] },
    { poi: "Monte Olimpo", correctChapter: 4, options: ["Capítulo 4", "Capítulo 5", "Capítulo 6"] },
    { poi: "Dojo Demoníaco", correctChapter: 5, options: ["Capítulo 5", "Capítulo 6", "Capítulo 4"] }
];
const chapterVideos = {
    'CAPÍTULO 1': 'WJW-bzXZM8M', 'CAPÍTULO 2': 'i6lR2s-0EU0', 'CAPÍTULO 3': '0BI6wPEJSDo',
    'CAPÍTULO 4': 'JW-KIbV9PRU', 'CAPÍTULO 5': '1XcgbOAkRIQ', 'CAPÍTULO 6': 'LrfzND9Dgq8'
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
        modalElement.addEventListener('hidden.bs.modal', function() { document.getElementById('mapModalVideo').src = ''; }, { once: true });
        new bootstrap.Modal(modalElement).show();
    } catch(e) { alert(titulo + '\n\n' + descripcion); }
}

function loadQuizQuestion() {
    if (currentQuizIndex >= quizQuestions.length) currentQuizIndex = 0;
    const q = quizQuestions[currentQuizIndex];
    $('#quizQuestion').text(`¿En qué capítulo apareció "${q.poi}"?`);
    let optionsHtml = '';
    q.options.forEach(opt => { const isCorrect = (opt === `Capítulo ${q.correctChapter + 1}`); optionsHtml += `<div class="quiz-option" data-correct="${isCorrect}" data-chapter-name="${opt}">${opt}</div>`; });
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
            if (typeof showToast === 'function') showToast('🎉 Respuesta correcta', quizQuestions[currentQuizIndex].poi + ' es del ' + correctChapter);
        } else {
            $(this).addClass('wrong');
            $('#quizResult').html(`❌ Incorrecto. ${quizQuestions[currentQuizIndex].poi} apareció en el ${correctChapter}`).addClass('wrong-result');
            playSound('click');
            $('.quiz-option').each(function() { if ($(this).data('correct') === true) $(this).addClass('correct'); });
        }
        $('.quiz-option').addClass('disabled');
        setTimeout(() => { currentQuizIndex++; loadQuizQuestion(); }, 2500);
    });
}

function initMapsPage() {
    loadQuizQuestion();
    $(document).on('mouseenter', '.timeline-card', function() { if (typeof playHover === 'function') playHover(); });
}

window.abrirModalMapa = abrirModalMapa;

// --------------------------------------------------------------
// EFECTOS VISUALES
// --------------------------------------------------------------
function initScrollProgress() {
    $(window).on('scroll', function() { $('.scroll-progress').css('width', ($(document).scrollTop() / ($(document).height() - $(window).height())) * 100 + '%'); });
}

function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';
    function type() { if (i < text.length) { element.textContent += text.charAt(i); i++; setTimeout(type, speed); } }
    type();
}

function initTheme() {
    const savedTheme = localStorage.getItem('fortnite-theme');
    if (savedTheme === 'light') { $('body').addClass('light-mode'); $('#themeToggle i').removeClass('bi-moon-stars-fill').addClass('bi-sun-fill'); }
    else { $('body').removeClass('light-mode'); $('#themeToggle i').removeClass('bi-sun-fill').addClass('bi-moon-stars-fill'); }
}

function toggleTheme() {
    playSound('click');
    if ($('body').hasClass('light-mode')) { $('body').removeClass('light-mode'); localStorage.setItem('fortnite-theme', 'dark'); $('#themeToggle i').removeClass('bi-sun-fill').addClass('bi-moon-stars-fill'); }
    else { $('body').addClass('light-mode'); localStorage.setItem('fortnite-theme', 'light'); $('#themeToggle i').removeClass('bi-moon-stars-fill').addClass('bi-sun-fill'); }
}

function initTiltEffects() {
    if (typeof VanillaTilt !== 'undefined') {
        VanillaTilt.init(document.querySelectorAll(".cosmetic-card, .news-card, .stat-card, .slider-card, .banner-card"), { max: 8, speed: 400, glare: true, "max-glare": 0.3, scale: 1.02, easing: "cubic-bezier(.03,.98,.52,.99)" });
        VanillaTilt.init(document.querySelectorAll(".timeline-card"), { max: 6, speed: 300, glare: true, "max-glare": 0.2 });
    }
}

function initTooltips() {
    if (typeof tippy !== 'undefined') {
        tippy('#randomSkinBtn', { content: '🎲 ¡Obtén una skin aleatoria!', animation: 'scale', placement: 'bottom' });
        tippy('#newTipBtn', { content: '💡 Cambia el consejo de Fortnite', animation: 'scale', placement: 'bottom' });
        tippy('#backToTop', { content: '⬆️ Volver arriba', animation: 'scale', placement: 'left' });
        tippy('#themeToggle', { content: '🌙 Cambiar tema claro/oscuro', animation: 'scale', placement: 'bottom' });
        $('.filter-btn').each(function() { tippy(this, { content: $(this).text() + ' 🔍', animation: 'scale', placement: 'top' }); });
        $('.btn-filter-toggle').each(function() { tippy(this, { content: '📂 Mostrar/ocultar filtros', animation: 'scale', placement: 'top' }); });
    }
}

function initMicroInteractions() {
    $('.btn, .favorite-btn, .nav-chapter-btn, .banner-filter-btn').on('click', function() { $(this).addClass('btn-pulse'); setTimeout(() => $(this).removeClass('btn-pulse'), 200); });
    $('.cosmetic-card, .news-card, .stat-card').on('mouseenter', function() { $(this).css('transition', 'all 0.2s ease'); });
}

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
    "💨 El humo de las granadas puede cubrir tu escape."
];

function showRandomTip() { $('#currentTip').text(fortniteTips[Math.floor(Math.random() * fortniteTips.length)]); }

// --------------------------------------------------------------
// EFECTOS DE ESTILO
// --------------------------------------------------------------
const btnPulseStyle = `@keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.98); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }.btn-pulse { animation: pulse 0.2s ease-out; }`;
$('head').append(`<style>${btnPulseStyle}</style>`);

// --------------------------------------------------------------
// INICIO DE LA PÁGINA
// --------------------------------------------------------------
$(document).ready(function() {
    console.log('Fortnite Hub iniciado');
    
    initTheme();
    $('#themeToggle').on('click', toggleTheme);
    initFilterToggles();
    setCurrentYear();
    initScrollProgress();
    if (document.getElementById('typed-title')) typeWriter(document.getElementById('typed-title'), 'EL UNIVERSO FORTNITE', 100);
    $('#newTipBtn').on('click', function() { playSound('click'); showRandomTip(); });
    showRandomTip();
    updateFavoritesDisplay();
    updateFavoritesPreview();
    
    $('#backToTop').on('click', () => $('html, body').animate({ scrollTop: 0 }, 500));
    
    $('a[href^="#"]').on('click', function(e) {
        const target = $(this.getAttribute('href'));
        if (target.length) {
            e.preventDefault();
            $('html, body').animate({ scrollTop: target.offset().top - 70 }, 800);
        }
    });
    
    // Sonido hover
    $('body').on('mouseenter', '.btn, .cosmetic-card, .news-card, .stat-card, .slider-card, .favorite-btn, .filter-btn, .btn-filter-toggle, .favorite-item', function() { playHover(); });
    
    // DETECCIÓN DE PÁGINA
    const currentPage = window.location.pathname;
    
    if (currentPage.includes('shop.html')) {
        console.log('🛒 Página: Tienda');
        loadShopCosmetics();
    } else if (currentPage.includes('compare.html')) {
        console.log('⚖️ Página: Comparador');
        loadSkinsForCompare();
        initRandomForSkin1();
        initRandomForSkin2();
        initDeselectButtons();
        initAsciiAnimation();
        updateHistoryDisplay();
        updateCompareFavoritesList();
    } else if (currentPage.includes('maps.html')) {
        console.log('🗺️ Página: Línea del tiempo de mapas');
        initTimeline();
        initMapsPage();
    } else if (currentPage.includes('banners.html')) {
        console.log('🖼️ Página: Galería de Banners');
        loadBanners();
        $('#loadMoreBanners').on('click', loadMoreBanners);
    } else {
        console.log('🏠 Página: Inicio');
        loadStats();
        loadNews();
        initCountdown();
        loadTrending();
    }
    
    // Efectos visuales (se ejecutan después de cargar el contenido)
    setTimeout(() => {
        initTiltEffects();
        initTooltips();
        initMicroInteractions();
    }, 500);
    
    window.toggleFavorite = toggleFavorite;
    window.selectFavoriteForCompare = selectFavoriteForCompare;
    window.showSkinModal = showSkinModal;
    window.reloadComparison = reloadComparison;
});