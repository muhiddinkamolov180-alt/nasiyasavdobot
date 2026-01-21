const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ========================
// 1. TOKEN VA ADMIN SOZLAMALARI
// ========================
const token = '8505540452:AAF4KzNUgYr7qS7Pu21bNGVWtBAlqtvsvrI';

// Adminlar ro'yxati (bir nechta admin bo'lishi mumkin)
const ADMINS = [123456789]; // @muhiddin_kamolov ning ID sini qo'ying

// Tort narxlari
const CAKE_PRICES = {
    'small': 80000,    // Kichik tort
    'medium': 120000,  // O'rta tort
    'large': 180000,   // Katta tort
    'custom': 0        // Maxsus narx
};

// ========================
// 2. BOTNI YARATISH
// ========================
console.log('🎂 Tort Buyurtma Boti yuklanmoqda...');

let bot;
try {
    bot = new TelegramBot(token, { 
        polling: {
            interval: 300,
            autoStart: true,
            params: {
                timeout: 10,
                limit: 100
            }
        }
    });
    console.log('✅ Bot yaratildi');
} catch (error) {
    console.error('❌ Bot yaratishda xato:', error.message);
    process.exit(1);
}

// ========================
// 3. MA'LUMOTLAR BAZASI
// ========================
const DB_FILE = 'orders.json';

// Fayl mavjudligini tekshirish
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ 
        users: [], 
        orders: [],
        admins: ADMINS,
        settings: {
            delivery_price: 15000,
            working_hours: "09:00 - 22:00",
            phone: "+998905982909",
            location: "Namangan shahri"
        }
    }, null, 2));
    console.log('📁 Yangi orders.json fayli yaratildi');
}

// ========================
// 4. ASOSIY FUNKSIYALAR
// ========================
function readData() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Fayl o\'qish xatosi:', error.message);
        return { 
            users: [], 
            orders: [], 
            admins: ADMINS,
            settings: {
                delivery_price: 15000,
                working_hours: "09:00 - 22:00",
                phone: "+998905982909",
                location: "Namangan shahri"
            }
        };
    }
}

function saveData(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Fayl yozish xatosi:', error.message);
    }
}

function isAdmin(userId) {
    const data = readData();
    return data.admins.includes(parseInt(userId));
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('uz-UZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ========================
// 5. MENYULAR
// ========================
function showMainMenu(chatId, name) {
    const options = {
        reply_markup: {
            keyboard: [
                ['🎂 Tort buyurtma qilish'],
                ['📋 Mening buyurtmalarim'],
                ['📞 Biz bilan aloqa'],
                ['ℹ️ Biz haqimizda']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, `🎉 Salom ${name}!\n\n"Sweet Cake" tort do'koniga xush kelibsiz!\nQuyidagi menyudan tanlang:`, options);
}

function showAdminMenu(chatId, name) {
    const options = {
        reply_markup: {
            keyboard: [
                ['📊 Statistika'],
                ['📋 Barcha buyurtmalar'],
                ['🔄 Jarayondagi buyurtmalar'],
                ['✅ Yakunlangan buyurtmalar'],
                ['⚙️ Sozlamalar'],
                ['📢 Reklama yuborish']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, `🛡️ Admin panel, ${name}!\nBuyurtmalarni boshqarishingiz mumkin:`, options);
}

// ========================
// 6. START KOMANDASI
// ========================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name;
    
    console.log(`👤 Yangi foydalanuvchi: ${name} (${chatId})`);
    
    // Foydalanuvchini saqlash
    const data = readData();
    const userExists = data.users.find(u => u.id === chatId);
    
    if (!userExists) {
        data.users.push({
            id: chatId,
            name: name,
            username: msg.from.username || 'Noma\'lum',
            phone: '',
            address: '',
            registered: new Date().toISOString(),
            orders_count: 0,
            total_spent: 0
        });
        saveData(data);
    }
    
    if (isAdmin(chatId)) {
        showAdminMenu(chatId, name);
    } else {
        showMainMenu(chatId, name);
    }
});

// ========================
// 7. TORT BUYURTMA QILISH - YANGI VERSIYA
// ========================
let orderState = {};

bot.onText(/🎂 Tort buyurtma qilish/, (msg) => {
    const chatId = msg.chat.id;
    
    // 1. Tort hajmini tanlash
    const sizeOptions = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔸 Kichik (6-8 kishi) - 80,000 so\'m', callback_data: 'size_small' },
                    { text: '🔸 O\'rta (10-12 kishi) - 120,000 so\'m', callback_data: 'size_medium' }
                ],
                [
                    { text: '🔸 Katta (15-20 kishi) - 180,000 so\'m', callback_data: 'size_large' },
                    { text: '🔸 Maxsus tort', callback_data: 'size_custom' }
                ]
            ]
        }
    };
    
    bot.sendMessage(chatId, '🎂 *1-qadam: Tort hajmini tanlang*\n\nQanday hajmdagi tort buyurtma qilmoqchisiz?', {
        reply_markup: sizeOptions.reply_markup,
        parse_mode: 'Markdown'
    });
});

// ========================
// 8. CALLBACK QUERY HANDLER - YANGI SOROVNOMA
// ========================
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;
    
    if (data.startsWith('size_')) {
        const size = data.split('_')[1];
        orderState[chatId] = { 
            size: size,
            step: 1 
        };
        
        let price = CAKE_PRICES[size];
        
        // Tort hajmi tanlandi
        bot.editMessageText(`✅ *Hajm tanlandi:* ${size === 'small' ? 'Kichik' : size === 'medium' ? 'O\'rta' : size === 'large' ? 'Katta' : 'Maxsus'}\n\n*2-qadam: Tort shaklini tanlang*`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
        
        // 2. Tort shaklini tanlash
        const shapeOptions = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🔴 Dumaloq', callback_data: 'shape_round' },
                        { text: '🟦 Kvadrat', callback_data: 'shape_square' }
                    ],
                    [
                        { text: '❤️ Yurak', callback_data: 'shape_heart' },
                        { text: '⭐️ Yulduz', callback_data: 'shape_star' }
                    ],
                    [
                        { text: '🎂 Boshqa shakl', callback_data: 'shape_other' }
                    ]
                ]
            }
        };
        
        setTimeout(() => {
            bot.sendMessage(chatId, '🎂 *Tort shaklini tanlang:*\n\nQaysi shaklda tort istaysiz?', {
                reply_markup: shapeOptions.reply_markup,
                parse_mode: 'Markdown'
            });
        }, 500);
        
        bot.answerCallbackQuery(callbackQuery.id);
        
    } else if (data.startsWith('shape_')) {
        const shape = data.split('_')[1];
        orderState[chatId].shape = shape;
        orderState[chatId].step = 2;
        
        const shapeNames = {
            'round': 'Dumaloq',
            'square': 'Kvadrat',
            'heart': 'Yurak',
            'star': 'Yulduz',
            'other': 'Boshqa shakl'
        };
        
        bot.editMessageText(`✅ *Shakl tanlandi:* ${shapeNames[shape]}\n\n*3-qadam: Tort bezagini tanlang*`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
        
        // 3. Tort bezagini tanlash
        const decorationOptions = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🎨 Rangli krem', callback_data: 'decoration_cream' },
                        { text: '🍫 Shokolad', callback_data: 'decoration_chocolate' }
                    ],
                    [
                        { text: '🍓 Mevali', callback_data: 'decoration_fruit' },
                        { text: '💎 Zebo bezaklar', callback_data: 'decoration_fancy' }
                    ],
                    [
                        { text: '✨ Oddiy bezak', callback_data: 'decoration_simple' }
                    ]
                ]
            }
        };
        
        setTimeout(() => {
            bot.sendMessage(chatId, '🎂 *Tort bezagini tanlang:*\n\nQanday bezak istaysiz?', {
                reply_markup: decorationOptions.reply_markup,
                parse_mode: 'Markdown'
            });
        }, 500);
        
        bot.answerCallbackQuery(callbackQuery.id);
        
    } else if (data.startsWith('decoration_')) {
        const decoration = data.split('_')[1];
        orderState[chatId].decoration = decoration;
        orderState[chatId].step = 3;
        
        const decorationNames = {
            'cream': 'Rangli krem',
            'chocolate': 'Shokolad',
            'fruit': 'Mevali',
            'fancy': 'Zebo bezaklar',
            'simple': 'Oddiy bezak'
        };
        
        bot.editMessageText(`✅ *Bezak tanlandi:* ${decorationNames[decoration]}\n\n*4-qadam: Tortunizga yozuv kerakmi?*`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
        
        // 4. Yozuv kerakligini so'rash
        const textOptions = {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '✅ Ha, yozuv kerak', callback_data: 'text_yes' },
                        { text: '❌ Yo\'q, yozuv kerak emas', callback_data: 'text_no' }
                    ]
                ]
            }
        };
        
        setTimeout(() => {
            bot.sendMessage(chatId, '✏️ *Tortunizga maxsus yozuv qo\'shilsinmi?*\n\nMasalan: "Tug\'ilgan kuning bilan", ism, va h.k.', {
                reply_markup: textOptions.reply_markup,
                parse_mode: 'Markdown'
            });
        }, 500);
        
        bot.answerCallbackQuery(callbackQuery.id);
        
    } else if (data.startsWith('text_')) {
        const needText = data.split('_')[1];
        orderState[chatId].needText = needText;
        orderState[chatId].step = 4;
        
        bot.editMessageText(`✅ *Yozuv:* ${needText === 'yes' ? 'Kerak' : 'Kerak emas'}\n\n*5-qadam: Qo'shimcha izohlaringiz*`, {
            chat_id: chatId,
            message_id: messageId,
            parse_mode: 'Markdown'
        });
        
        if (needText === 'yes') {
            setTimeout(() => {
                bot.sendMessage(chatId, '✏️ *Iltimos, tortunizga qanday yozuv yozilsin?*\n\nMasalan: "Azizaga, 18 yosh bilan!"');
            }, 500);
            
            // Yozuvni kutish
            bot.once('message', (textMsg) => {
                if (textMsg.chat.id === chatId) {
                    orderState[chatId].text = textMsg.text;
                    askAdditionalInfo(chatId);
                }
            });
        } else {
            orderState[chatId].text = '';
            askAdditionalInfo(chatId);
        }
        
        bot.answerCallbackQuery(callbackQuery.id);
        
    } else if (data.startsWith('additional_')) {
        const answer = data.split('_')[1];
        orderState[chatId].additional = answer;
        
        if (answer === 'yes') {
            bot.sendMessage(chatId, `📝 *Iltimos, qo'shimcha izohlaringizni yozing:*\n\nMasalan: "Krem rangini pushti qiling", "Meva sifatida anor qo'shing" va h.k.`);
            
            bot.once('message', (additionalMsg) => {
                if (additionalMsg.chat.id === chatId) {
                    orderState[chatId].additionalNotes = additionalMsg.text;
                    askDeliveryOption(chatId);
                }
            });
        } else {
            orderState[chatId].additionalNotes = '';
            askDeliveryOption(chatId);
        }
        
        bot.answerCallbackQuery(callbackQuery.id);
        
    } else if (data.startsWith('delivery_')) {
        const deliveryType = data.split('_')[1];
        orderState[chatId].delivery = deliveryType;
        orderState[chatId].step = 6;
        
        if (deliveryType === 'yes') {
            bot.sendMessage(chatId, `📍 *Iltimos, yetkazib berish manzilingizni yuboring:*\n\n1. *Lokatsiya yuborish uchun 📎 tugmasini bosing va "Lokatsiya"ni tanlang*\n2. Yoki qo'lda manzil yozing\n\nMasalan: "Namangan sh, Boburshox ko\'chasi, 12-uy, 45-xonadon`);
            
            // Lokatsiya kutish
            bot.once('message', (locationMsg) => {
                if (locationMsg.chat.id === chatId) {
                    if (locationMsg.location) {
                        // Agar lokatsiya yuborilsa
                        orderState[chatId].address = `📍 Lokatsiya: ${locationMsg.location.latitude}, ${locationMsg.location.longitude}`;
                        orderState[chatId].hasLocation = true;
                    } else {
                        // Agar matn yuborilsa
                        orderState[chatId].address = locationMsg.text;
                        orderState[chatId].hasLocation = false;
                    }
                    askPhoneNumber(chatId);
                }
            });
        } else {
            orderState[chatId].address = '🏃 Olib ketish';
            orderState[chatId].hasLocation = false;
            askPhoneNumber(chatId);
        }
        
        bot.answerCallbackQuery(callbackQuery.id);
        
    } else if (data.startsWith('confirm_order')) {
        completeOrder(chatId, callbackQuery.from.first_name);
        bot.answerCallbackQuery(callbackQuery.id);
        
    } else if (data.startsWith('order_')) {
        const action = data.split('_')[1];
        const orderId = data.split('_')[2];
        
        if (action === 'accept') {
            acceptOrder(chatId, orderId);
        } else if (action === 'reject') {
            rejectOrder(chatId, orderId);
        } else if (action === 'complete') {
            completeOrderAdmin(chatId, orderId);
        }
        
        bot.answerCallbackQuery(callbackQuery.id);
        
    } else if (data === 'cancel_order') {
        delete orderState[chatId];
        bot.sendMessage(chatId, '❌ Buyurtma bekor qilindi.');
        bot.answerCallbackQuery(callbackQuery.id);
    }
});

function askAdditionalInfo(chatId) {
    const additionalOptions = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Ha, qo\'shimcha izohlarim bor', callback_data: 'additional_yes' },
                    { text: '❌ Yo\'q, hammasi aniq', callback_data: 'additional_no' }
                ]
            ]
        }
    };
    
    bot.sendMessage(chatId, '📝 *Qo\'shimcha izohlaringiz bormi?*\n\nTort haqida qo\'shimcha istaklaringiz, talablaringiz?', {
        reply_markup: additionalOptions.reply_markup,
        parse_mode: 'Markdown'
    });
}

function askDeliveryOption(chatId) {
    const data = readData();
    const deliveryPrice = data.settings.delivery_price;
    
    const deliveryOptions = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: `🚚 Yetkazib berish (+${formatNumber(deliveryPrice)} so'm)`, callback_data: 'delivery_yes' }
                ],
                [
                    { text: '🏃 Olib ketish', callback_data: 'delivery_no' }
                ]
            ]
        }
    };
    
    bot.sendMessage(chatId, `🚚 *6-qadam: Yetkazib berish usuli*\n\nQanday usulda olishni xohlaysiz?\n\nYetkazib berish narxi: *${formatNumber(deliveryPrice)} so'm*`, {
        reply_markup: deliveryOptions.reply_markup,
        parse_mode: 'Markdown'
    });
}

function askPhoneNumber(chatId) {
    orderState[chatId].step = 7;
    
    const phoneOptions = {
        reply_markup: {
            keyboard: [
                [{ text: '📱 Telefon raqamimni yuborish', request_contact: true }],
                ['📝 Qo\'lda kiritish']
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, '📱 *7-qadam: Telefon raqamingiz*\n\nIltimos, telefon raqamingizni yuboring:', {
        reply_markup: phoneOptions.reply_markup,
        parse_mode: 'Markdown'
    });
    
    // Telefon raqamini kutish
    bot.once('message', (phoneMsg) => {
        if (phoneMsg.chat.id === chatId) {
            let phone = '';
            
            if (phoneMsg.contact) {
                // Agar kontakt yuborilsa
                phone = phoneMsg.contact.phone_number;
            } else if (phoneMsg.text === '📝 Qo\'lda kiritish') {
                bot.sendMessage(chatId, '📝 Iltimos, telefon raqamingizni kiriting:\n\nNamuna: 905982909');
                
                bot.once('message', (manualPhoneMsg) => {
                    if (manualPhoneMsg.chat.id === chatId) {
                        phone = manualPhoneMsg.text.replace(/\D/g, '');
                        if (phone.length < 9) {
                            bot.sendMessage(chatId, '❌ Noto\'g\'ri telefon raqami! Qaytadan kiriting:');
                            askPhoneNumber(chatId);
                            return;
                        }
                        orderState[chatId].phone = phone;
                        showOrderSummary(chatId);
                    }
                });
                return;
            } else {
                // Agar to'g'ridan-to'g'ri raqam yozilsa
                phone = phoneMsg.text.replace(/\D/g, '');
            }
            
            if (phone.length < 9) {
                bot.sendMessage(chatId, '❌ Noto\'g\'ri telefon raqami! Qaytadan kiriting:');
                askPhoneNumber(chatId);
                return;
            }
            
            orderState[chatId].phone = phone;
            showOrderSummary(chatId);
        }
    });
}

function showOrderSummary(chatId) {
    const order = orderState[chatId];
    const data = readData();
    const deliveryPrice = data.settings.delivery_price;
    
    let totalPrice = CAKE_PRICES[order.size] || 0;
    if (order.size === 'custom') {
        totalPrice = order.customPrice || 0;
    }
    
    let deliveryText = '';
    let deliveryCost = 0;
    
    if (order.delivery === 'yes') {
        deliveryCost = deliveryPrice;
        totalPrice += deliveryCost;
        deliveryText = `🚚 *Yetkazib berish:* ${formatNumber(deliveryCost)} so'm\n📍 *Manzil:* ${order.address}`;
    } else {
        deliveryText = '🏃 *Olib ketish*';
    }
    
    const sizeNames = {
        'small': 'Kichik (6-8 kishi)',
        'medium': 'O\'rta (10-12 kishi)',
        'large': 'Katta (15-20 kishi)',
        'custom': 'Maxsus tort'
    };
    
    const shapeNames = {
        'round': 'Dumaloq',
        'square': 'Kvadrat',
        'heart': 'Yurak',
        'star': 'Yulduz',
        'other': 'Boshqa shakl'
    };
    
    const decorationNames = {
        'cream': 'Rangli krem',
        'chocolate': 'Shokolad',
        'fruit': 'Mevali',
        'fancy': 'Zebo bezaklar',
        'simple': 'Oddiy bezak'
    };
    
    // Buyurtma tafsilotlari
    const summary = `📋 *BUYURTMA XULOSASI*\n
🎂 *Tort hajmi:* ${sizeNames[order.size]}
🔷 *Shakli:* ${shapeNames[order.shape]}
✨ *Bezagi:* ${decorationNames[order.decoration]}
${order.needText === 'yes' ? `✏️ *Yozuv:* ${order.text}\n` : '✏️ *Yozuv:* Yo\'q\n'}
${order.additional === 'yes' ? `📝 *Qo'shimcha izohlar:* ${order.additionalNotes}\n` : ''}
${deliveryText}
📱 *Telefon:* ${order.phone}

💰 *Tort narxi:* ${formatNumber(totalPrice - deliveryCost)} so'm
${order.delivery === 'yes' ? `🚚 *Yetkazish:* ${formatNumber(deliveryCost)} so'm\n` : ''}
💵 *JAMI SUMMA: ${formatNumber(totalPrice)} so'm*`;
    
    const confirmOptions = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Tasdiqlash', callback_data: 'confirm_order' },
                    { text: '❌ Bekor qilish', callback_data: 'cancel_order' }
                ]
            ]
        }
    };
    
    bot.sendMessage(chatId, summary, {
        reply_markup: confirmOptions.reply_markup,
        parse_mode: 'Markdown'
    });
}

function completeOrder(chatId, userName) {
    const order = orderState[chatId];
    const data = readData();
    const deliveryPrice = data.settings.delivery_price;
    
    // Jami summani hisoblash
    let tortPrice = CAKE_PRICES[order.size] || 0;
    if (order.size === 'custom') {
        tortPrice = order.customPrice || 0;
    }
    
    let totalPrice = tortPrice;
    if (order.delivery === 'yes') {
        totalPrice += deliveryPrice;
    }
    
    // Buyurtmani saqlash
    const newOrder = {
        id: Date.now(),
        userId: chatId,
        userName: userName,
        userPhone: order.phone,
        size: order.size,
        shape: order.shape,
        decoration: order.decoration,
        needText: order.needText,
        text: order.text || '',
        additionalNotes: order.additionalNotes || '',
        description: `Hajm: ${order.size}, Shakl: ${order.shape}, Bezak: ${order.decoration}${order.needText === 'yes' ? `, Yozuv: ${order.text}` : ''}${order.additionalNotes ? `, Qo'shimcha: ${order.additionalNotes}` : ''}`,
        price: tortPrice,
        delivery: order.delivery,
        address: order.address,
        hasLocation: order.hasLocation || false,
        deliveryPrice: order.delivery === 'yes' ? deliveryPrice : 0,
        totalPrice: totalPrice,
        status: 'pending',
        createdAt: new Date().toISOString(),
        acceptedAt: null,
        completedAt: null
    };
    
    data.orders.push(newOrder);
    
    // Foydalanuvchi statistikasini yangilash
    const userIndex = data.users.findIndex(u => u.id === chatId);
    if (userIndex !== -1) {
        data.users[userIndex].orders_count += 1;
        data.users[userIndex].total_spent += totalPrice;
        data.users[userIndex].phone = order.phone;
        if (order.address !== '🏃 Olib ketish') {
            data.users[userIndex].address = order.address;
        }
    }
    
    saveData(data);
    
    // Foydalanuvchiga tasdiqlash
    bot.sendMessage(chatId, '✅ *Buyurtmangiz qabul qilindi!*\n\n🎉 Rahmat! Buyurtmangiz muvaffaqiyatli qabul qilindi.\n\n📞 Adminlar tez orada siz bilan bog\'lanadi.\n📋 Buyurtma holatini "Mening buyurtmalarim" bo\'limidan kuzatishingiz mumkin.', {
        parse_mode: 'Markdown'
    });
    
    // Adminlarga xabar yuborish
    notifyAdminsAboutNewOrder(newOrder);
    
    // State ni tozalash
    delete orderState[chatId];
}

function notifyAdminsAboutNewOrder(order) {
    const data = readData();
    const sizeNames = {
        'small': 'Kichik',
        'medium': 'O\'rta',
        'large': 'Katta',
        'custom': 'Maxsus'
    };
    
    const orderMessage = `🆕 *YANGI BUYURTMA!* #${order.id}\n
👤 *Mijoz:* ${order.userName}
📱 *Telefon:* ${order.userPhone}
🎂 *Tort hajmi:* ${sizeNames[order.size]}
🔷 *Shakli:* ${order.shape}
✨ *Bezagi:* ${order.decoration}
${order.needText === 'yes' ? `✏️ *Yozuv:* ${order.text}\n` : ''}
${order.additionalNotes ? `📝 *Qo'shimcha:* ${order.additionalNotes}\n` : ''}
🚚 *Yetkazish:* ${order.delivery === 'yes' ? 'Yetkazib berish' : 'Olib ketish'}
📍 *Manzil:* ${order.address}
💰 *Tort narxi:* ${formatNumber(order.price)} so'm
${order.delivery === 'yes' ? `🚚 *Yetkazish:* ${formatNumber(order.deliveryPrice)} so'm\n` : ''}
💵 *Jami:* ${formatNumber(order.totalPrice)} so'm
⏰ *Vaqt:* ${formatDate(order.createdAt)}`;
    
    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '✅ Qabul qilish', callback_data: `order_accept_${order.id}` },
                    { text: '❌ Rad etish', callback_data: `order_reject_${order.id}` }
                ]
            ]
        },
        parse_mode: 'Markdown'
    };
    
    // Barcha adminlarga yuborish
    data.admins.forEach(adminId => {
        bot.sendMessage(adminId, orderMessage, options);
    });
}

// ========================
// 9. ADMIN FUNKSIYALARI
// ========================
function acceptOrder(adminId, orderId) {
    const data = readData();
    const orderIndex = data.orders.findIndex(o => o.id == orderId);
    
    if (orderIndex !== -1) {
        data.orders[orderIndex].status = 'accepted';
        data.orders[orderIndex].acceptedAt = new Date().toISOString();
        saveData(data);
        
        // Adminga tasdiqlash
        bot.sendMessage(adminId, `✅ Buyurtma #${orderId} qabul qilindi!`);
        
        // Mijozga xabar
        const order = data.orders[orderIndex];
        bot.sendMessage(order.userId, 
            `✅ *Buyurtmangiz qabul qilindi!* #${orderId}\n\n` +
            `🎉 Tabriklaymiz! Buyurtmangiz qabul qilindi.\n\n` +
            `📞 Tez orada siz bilan bog'lanamiz.\n` +
            `💰 *Jami to'lov:* ${formatNumber(order.totalPrice)} so'm\n\n` +
            `📋 Holatni "Mening buyurtmalarim" bo'limidan kuzatishingiz mumkin.`,
            { parse_mode: 'Markdown' }
        );
    }
}

function rejectOrder(adminId, orderId) {
    const data = readData();
    const orderIndex = data.orders.findIndex(o => o.id == orderId);
    
    if (orderIndex !== -1) {
        data.orders[orderIndex].status = 'rejected';
        saveData(data);
        
        // Adminga tasdiqlash
        bot.sendMessage(adminId, `❌ Buyurtma #${orderId} rad etildi!`);
        
        // Mijozga xabar
        const order = data.orders[orderIndex];
        bot.sendMessage(order.userId, 
            `❌ *Kechirasiz!* #${orderId}\n\n` +
            `Buyurtmangiz texnik sabablarga ko'ra rad etildi.\n\n` +
            `📞 Batafsil ma'lumot uchun admin bilan bog'laning.\n` +
            `📞 Telefon: +998905982909`,
            { parse_mode: 'Markdown' }
        );
    }
}

function completeOrderAdmin(adminId, orderId) {
    const data = readData();
    const orderIndex = data.orders.findIndex(o => o.id == orderId);
    
    if (orderIndex !== -1) {
        data.orders[orderIndex].status = 'completed';
        data.orders[orderIndex].completedAt = new Date().toISOString();
        saveData(data);
        
        // Adminga tasdiqlash
        bot.sendMessage(adminId, `🎉 Buyurtma #${orderId} yakunlandi!`);
        
        // Mijozga xabar
        const order = data.orders[orderIndex];
        bot.sendMessage(order.userId, 
            `🎉 *Buyurtmangiz yakunlandi!* #${orderId}\n\n` +
            `✅ Sizning tortingiz tayyor va ${order.delivery === 'yes' ? 'yetkazib berildi' : 'olib ketildi'}!\n\n` +
            `🍰 Mazali tortingizdan rohatlaning!\n` +
            `🙏 Bizni tanlaganingiz uchun rahmat!\n\n` +
            `🔄 Yana buyurtma berish uchun /start bosing.`,
            { parse_mode: 'Markdown' }
        );
    }
}

// ========================
// 10. MENYU HANDLERLARI
// ========================
// Mening buyurtmalarim
bot.onText(/📋 Mening buyurtmalarim/, (msg) => {
    const chatId = msg.chat.id;
    const data = readData();
    
    const userOrders = data.orders.filter(o => o.userId === chatId);
    
    if (userOrders.length === 0) {
        bot.sendMessage(chatId, '📭 *Sizda hali buyurtmalar yo\'q.*\n\n🎂 Birinchi tort buyurtma qiling!', {
            parse_mode: 'Markdown'
        });
        return;
    }
    
    let message = '📋 *MENING BUYURTMALARIM*\n\n';
    
    userOrders.forEach((order, index) => {
        const sizeNames = {
            'small': 'Kichik',
            'medium': 'O\'rta',
            'large': 'Katta',
            'custom': 'Maxsus'
        };
        
        const statusIcons = {
            'pending': '⏳',
            'accepted': '✅',
            'rejected': '❌',
            'completed': '🎉'
        };
        
        const statusTexts = {
            'pending': 'Kutilmoqda',
            'accepted': 'Qabul qilindi',
            'rejected': 'Rad etildi',
            'completed': 'Yakunlandi'
        };
        
        message += `*${index + 1}. Buyurtma #${order.id}*\n`;
        message += `   🎂 ${sizeNames[order.size]} tort\n`;
        message += `   💰 ${formatNumber(order.totalPrice)} so'm\n`;
        message += `   📅 ${formatDate(order.createdAt)}\n`;
        message += `   📊 Holat: ${statusIcons[order.status]} ${statusTexts[order.status]}\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// 📞 BIZ BILAN ALOQA - TUZATILGAN
bot.onText(/📞 Biz bilan aloqa/, (msg) => {
    const chatId = msg.chat.id;
    const data = readData();
    const settings = data.settings;
    
    const contactInfo = `📞 *BIZ BILAN BOG'LANISH*\n\n` +
        `📱 *Telefon raqam:* ${settings.phone}\n` +
        `🕒 *Ish vaqti:* ${settings.working_hours}\n` +
        `📍 *Manzil:* ${settings.location}\n` +
        `🌐 *Telegram:* @muhiddin_kamolov\n\n` +
        `📨 *Savollaringiz bo'lsa:*\n` +
        `• Shu yerda yozishingiz mumkin\n` +
        `• Telefonga qo'ng'iroq qilishingiz mumkin\n` +
        `• Telegram orqali yozishingiz mumkin\n\n` +
        `⚡️ *Bizga murojaat qiling, sizga yordam beramiz!*`;
    
    bot.sendMessage(chatId, contactInfo, { parse_mode: 'Markdown' });
});

// ℹ️ Biz haqimizda
bot.onText(/ℹ️ Biz haqimizda/, (msg) => {
    const chatId = msg.chat.id;
    
    const aboutText = `🎂 *SWEET CAKE - TORT DO'KONI*\n\n` +
        `🍰 *Biz eng mazali va chiroyli tortlarni tayyorlaymiz!*\n\n` +
        `✨ *XIZMATLARIMIZ:*\n` +
        `• Har xil hajmdagi tortlar (kichik, o'rta, katta)\n` +
        `• Maxsus bezakli tortlar\n` +
        `• Shaxsiylashtirilgan yozuvlar\n` +
        `• Tez yetkazib berish\n` +
        `• Yuqori sifatli ingredientlar\n\n` +
        `💡 *QANDAY BUYURTMA BERISH MUMKIN?*\n` +
        `1. "🎂 Tort buyurtma qilish" ni bosing\n` +
        `2. Hajm, shakl, bezak tanlang\n` +
        `3. Yozuv kerak bo'lsa, yozing\n` +
        `4. Yetkazish usulini tanlang\n` +
        `5. Telefon raqamingizni kiriting\n` +
        `6. Tasdiqlang!\n\n` +
        `⏱️ *Buyurtmangiz 30 daqiqada tayyor bo'ladi!*\n\n` +
        `🎉 *Mijozlarimizning baxti - bizning g'ururimiz!*`;
    
    bot.sendMessage(chatId, aboutText, { parse_mode: 'Markdown' });
});

// ========================
// 11. ADMIN PANEL HANDLERLARI
// ========================
// Statistika
bot.onText(/📊 Statistika/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    const data = readData();
    const today = new Date().toISOString().split('T')[0];
    
    const totalOrders = data.orders.length;
    const pendingOrders = data.orders.filter(o => o.status === 'pending').length;
    const acceptedOrders = data.orders.filter(o => o.status === 'accepted').length;
    const completedOrders = data.orders.filter(o => o.status === 'completed').length;
    
    const todayOrders = data.orders.filter(o => o.createdAt.startsWith(today)).length;
    
    const totalRevenue = data.orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + o.totalPrice, 0);
    
    const todayRevenue = data.orders
        .filter(o => o.status === 'completed' && o.completedAt && o.completedAt.startsWith(today))
        .reduce((sum, o) => sum + o.totalPrice, 0);
    
    const stats = `📊 *STATISTIKA*\n\n` +
        `👥 *Jami mijozlar:* ${data.users.length} ta\n` +
        `📦 *Jami buyurtmalar:* ${totalOrders} ta\n\n` +
        `📊 *BUGUNGI KUN:*\n` +
        `🆕 *Yangi buyurtmalar:* ${todayOrders} ta\n` +
        `💰 *Bugungi daromad:* ${formatNumber(todayRevenue)} so'm\n\n` +
        `📈 *HOLATLAR:*\n` +
        `⏳ *Kutilayotgan:* ${pendingOrders} ta\n` +
        `✅ *Qabul qilingan:* ${acceptedOrders} ta\n` +
        `🎉 *Yakunlangan:* ${completedOrders} ta\n\n` +
        `💰 *UMUMIY DAROMAD:*\n` +
        `💵 *Jami:* ${formatNumber(totalRevenue)} so'm`;
    
    bot.sendMessage(chatId, stats, { parse_mode: 'Markdown' });
});

// Qolgan admin funksiyalari o'zgarmaydi...

// ========================
// 12. BOT ISHGA TUSHISHI
// ========================
console.log('\n🎉 ===============================');
console.log('🎂 SWEET CAKE BOT ISHGA TUSHDI!');
console.log('===============================\n');
console.log('🛡️ Adminlar:', ADMINS);
console.log('📊 Tort narxlari:', CAKE_PRICES);
console.log('\n📱 Botga kirish:');
console.log(`https://t.me/${token.split(':')[0]}_bot`);
console.log('\n💡 Buyurtma berish uchun: /start');

// ========================
// 13. TEST KOMANDASI
// ========================
bot.onText(/\/test/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `✅ Bot ishlayapti! Admin: ${isAdmin(chatId)}`);
});

// ========================
// 14. YORDAM KOMANDASI
// ========================
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const isAdminUser = isAdmin(chatId);
    
    let helpText = '🆘 *YORDAM*\n\n';
    
    if (isAdminUser) {
        helpText += '*ADMIN KOMANDALARI:*\n' +
            '/setdelivery [narx] - Yetkazish narxini o\'zgartirish\n' +
            '/setphone [telefon] - Telefon raqamini o\'zgartirish\n' +
            '/settime [vaqt] - Ish vaqtini o\'zgartirish\n' +
            '/addadmin [id] - Yangi admin qo\'shish\n' +
            '/test - Botni test qilish\n\n';
    }
    
    helpText += '*ASOSIY KOMANDALAR:*\n' +
        '/start - Botni boshlash\n' +
        '/help - Yordam\n\n' +
        '*MENYU ORQALI:*\n' +
        '🎂 Tort buyurtma qilish - Yangi tort buyurtma\n' +
        '📋 Mening buyurtmalarim - Buyurtmalar tarixi\n' +
        '📞 Biz bilan aloqa - Kontaktlar\n' +
        'ℹ️ Biz haqimizda - Ma\'lumot';
    
    if (isAdminUser) {
        helpText += '\n\n*ADMIN PANEL:*\n' +
            '📊 Statistika - Umumiy statistika\n' +
            '📋 Barcha buyurtmalar - Barcha buyurtmalar\n' +
            '🔄 Jarayondagi buyurtmalar - Yangi buyurtmalar\n' +
            '✅ Yakunlangan buyurtmalar - Tugallanganlar\n' +
            '⚙️ Sozlamalar - Bot sozlamalari\n' +
            '📢 Reklama yuborish - Hammaga xabar';
    }
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// ========================
// 15. QO'SHIMCHA - BARCHA ADMIN PANEL FUNKSIYALARI
// ========================
// Barcha buyurtmalar
bot.onText(/📋 Barcha buyurtmalar/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    showOrdersList(chatId, 'all');
});

// Jarayondagi buyurtmalar
bot.onText(/🔄 Jarayondagi buyurtmalar/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    showOrdersList(chatId, 'pending');
});

// Yakunlangan buyurtmalar
bot.onText(/✅ Yakunlangan buyurtmalar/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    showOrdersList(chatId, 'completed');
});

function showOrdersList(chatId, filter) {
    const data = readData();
    let orders = data.orders;
    
    if (filter === 'pending') {
        orders = orders.filter(o => o.status === 'pending');
    } else if (filter === 'completed') {
        orders = orders.filter(o => o.status === 'completed');
    }
    
    if (orders.length === 0) {
        bot.sendMessage(chatId, `📭 ${filter === 'all' ? 'Hozircha' : 'Jarayondagi'} buyurtmalar yo'q`);
        return;
    }
    
    let message = `📋 *${filter === 'all' ? 'BARCHA' : filter === 'pending' ? 'JARAYONDAGI' : 'YAKUNLANGAN'} BUYURTMALAR*\n\n`;
    
    orders.forEach((order, index) => {
        const sizeNames = {
            'small': 'Kichik',
            'medium': 'O\'rta',
            'large': 'Katta',
            'custom': 'Maxsus'
        };
        
        const statusIcons = {
            'pending': '⏳',
            'accepted': '✅',
            'rejected': '❌',
            'completed': '🎉'
        };
        
        message += `${index + 1}. *#${order.id}* - ${order.userName}\n`;
        message += `   📱 ${order.userPhone}\n`;
        message += `   🎂 ${sizeNames[order.size]} - ${formatNumber(order.totalPrice)} so'm\n`;
        message += `   📅 ${formatDate(order.createdAt)}\n`;
        message += `   📊 ${statusIcons[order.status]} ${order.status}\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

// Sozlamalar
bot.onText(/⚙️ Sozlamalar/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    const data = readData();
    const settings = data.settings;
    
    const settingsText = `⚙️ *SOZLAMALAR*\n\n` +
        `🚚 *Yetkazish narxi:* ${formatNumber(settings.delivery_price)} so'm\n` +
        `📞 *Telefon:* ${settings.phone}\n` +
        `🕒 *Ish vaqti:* ${settings.working_hours}\n` +
        `📍 *Manzil:* ${settings.location}\n\n` +
        `*ADMIN BUYRUG'LARI:*\n` +
        `/setdelivery [narx] - Yetkazish narxini o'zgartirish\n` +
        `/setphone [telefon] - Telefon raqamini o'zgartirish\n` +
        `/settime [vaqt] - Ish vaqtini o'zgartirish\n` +
        `/setlocation [manzil] - Manzilni o'zgartirish\n` +
        `/addadmin [id] - Yangi admin qo'shish`;
    
    bot.sendMessage(chatId, settingsText, { parse_mode: 'Markdown' });
});

// Manzilni o'zgartirish komandasi
bot.onText(/\/setlocation (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    const newLocation = match[1];
    const data = readData();
    data.settings.location = newLocation;
    saveData(data);
    
    bot.sendMessage(chatId, `✅ Manzil "${newLocation}" ga o'zgartirildi!`);
});

// Reklama yuborish
bot.onText(/📢 Reklama yuborish/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    bot.sendMessage(chatId, '📝 *Reklama matnini kiriting:*\n\nMarkdown formatda ham yozishingiz mumkin.', {
        parse_mode: 'Markdown'
    });
    
    bot.once('message', (adMsg) => {
        if (adMsg.chat.id === chatId) {
            const message = adMsg.text;
            const data = readData();
            const users = data.users;
            
            bot.sendMessage(chatId, `📤 *Reklama ${users.length} ta foydalanuvchiga yuborilmoqda...*`, {
                parse_mode: 'Markdown'
            });
            
            let sentCount = 0;
            let failedCount = 0;
            
            users.forEach(user => {
                // Agar foydalanuvchi o'zi admin bo'lsa, yuborma
                if (isAdmin(user.id) && user.id !== chatId) return;
                
                bot.sendMessage(user.id, message, { parse_mode: 'Markdown' })
                    .then(() => sentCount++)
                    .catch(() => failedCount++)
                    .finally(() => {
                        if (sentCount + failedCount === users.length) {
                            bot.sendMessage(chatId, 
                                `✅ *Reklama yuborildi!*\n\n` +
                                `✅ *Muvaffaqiyatli:* ${sentCount} ta\n` +
                                `❌ *Xatolik:* ${failedCount} ta`,
                                { parse_mode: 'Markdown' }
                            );
                        }
                    });
            });
        }
    });
});

// ========================
// 16. QO'SHIMCHA ADMIN KOMANDALARI
// ========================
// Yetkazish narxini o'zgartirish
bot.onText(/\/setdelivery (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    const newPrice = parseInt(match[1]);
    const data = readData();
    data.settings.delivery_price = newPrice;
    saveData(data);
    
    bot.sendMessage(chatId, `✅ Yetkazish narxi ${formatNumber(newPrice)} so'm ga o'zgartirildi!`);
});

// Telefon raqamini o'zgartirish
bot.onText(/\/setphone (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    const newPhone = match[1];
    const data = readData();
    data.settings.phone = newPhone;
    saveData(data);
    
    bot.sendMessage(chatId, `✅ Telefon raqami "${newPhone}" ga o'zgartirildi!`);
});

// Ish vaqtini o'zgartirish
bot.onText(/\/settime (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    const newTime = match[1];
    const data = readData();
    data.settings.working_hours = newTime;
    saveData(data);
    
    bot.sendMessage(chatId, `✅ Ish vaqti "${newTime}" ga o'zgartirildi!`);
});

// Yangi admin qo'shish
bot.onText(/\/addadmin (\d+)/, (msg, match) => {
    const chatId = msg.chat.id;
    
    if (!isAdmin(chatId)) {
        bot.sendMessage(chatId, '❌ Sizda admin huquqlari yo\'q!');
        return;
    }
    
    const newAdminId = parseInt(match[1]);
    const data = readData();
    
    if (data.admins.includes(newAdminId)) {
        bot.sendMessage(chatId, '❌ Bu foydalanuvchi allaqachon admin!');
        return;
    }
    
    data.admins.push(newAdminId);
    saveData(data);
    
    bot.sendMessage(chatId, `✅ ${newAdminId} ID li foydalanuvchi admin qilindi!`);
    bot.sendMessage(newAdminId, '🎉 *Tabriklaymiz! Siz admin huquqlariga ega bo\'ldingiz!*', {
        parse_mode: 'Markdown'
    });
});

// ========================
// 17. XATOLARNI QAYTA ISHLASH
// ========================
bot.on('polling_error', (error) => {
    console.log('⚠️  Polling xatosi:', error.message);
});

bot.on('error', (error) => {
    console.log('⚠️  Bot xatosi:', error.message);
});
