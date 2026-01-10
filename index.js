const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// 1. BotFather dan olingan token
const token = '8505540452:AAF4KzNUgYr7qS7Pu21bNGVWtBAlqtvsvrI'; // BU YERNI O'ZGARTIRING!

// 2. Botni yaratish
const bot = new TelegramBot(token, { polling: true });

// 3. Ma'lumotlar bazasi
const DB_FILE = 'debtors.json';

// Fayl mavjudligini tekshirish
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [], debtors: [] }, null, 2));
}

// 4. Ma'lumotlarni o'qish
function readData() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {n
        console.error('Xato:', error);
        return { users: [], debtors: [] };
    }
}

// 5. Ma'lumotlarni saqlash
function saveData(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Xato:', error);
    }
}

// 6. Raqamni formatlash
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 7. Asosiy menyu
function showMenu(chatId, name) {
    const options = {
        reply_markup: {
            keyboard: [
                ['➕ Qarzdor qo\'shish'],
                ['📋 Qarzdorlar ro\'yxati'],
                ['💰 To\'lov qilish'],
                ['📊 Statistika']
            ],
            resize_keyboard: true
        }
    };
    
    bot.sendMessage(chatId, `👋 Salom ${name}! Nasiya botiga xush kelibsiz!`, options);
}

// 8. /start komandasi
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const name = msg.from.first_name;
    
    console.log(`Yangi foydalanuvchi: ${name} (${chatId})`);
    
    // Ma'lumotlarni saqlash
    const data = readData();
    const userExists = data.users.find(u => u.id === chatId);
    
    if (!userExists) {
        data.users.push({
            id: chatId,
            name: name,
            username: msg.from.username,
            joined: new Date().toISOString()
        });
        saveData(data);
    }
    
    showMenu(chatId, name);
});

// 9. Qarzdor qo'shish
let userState = {};

bot.onText(/➕ Qarzdor qo\'shish/, (msg) => {
    const chatId = msg.chat.id;
    
    userState[chatId] = { step: 'name' };
    
    bot.sendMessage(chatId, '👤 Qarzdor ismini kiriting:');
    
    bot.once('message', (nextMsg) => {
        if (nextMsg.chat.id === chatId) {
            userState[chatId].name = nextMsg.text;
            userState[chatId].step = 'phone';
            
            bot.sendMessage(chatId, '📱 Telefon raqamini kiriting (masalan: 901234567):');
            
            bot.once('message', (nextMsg2) => {
                if (nextMsg2.chat.id === chatId) {
                    userState[chatId].phone = nextMsg2.text.replace(/\D/g, '');
                    userState[chatId].step = 'amount';
                    
                    bot.sendMessage(chatId, '💰 Qarz miqdorini kiriting (so\'m):');
                    
                    bot.once('message', (nextMsg3) => {
                        if (nextMsg3.chat.id === chatId) {
                            const amount = parseInt(nextMsg3.text.replace(/\D/g, '')) || 0;
                            
                            // Qarzdorni saqlash
                            const data = readData();
                            
                            const newDebtor = {
                                id: Date.now(),
                                name: userState[chatId].name,
                                phone: userState[chatId].phone,
                                amount: amount,
                                paid: 0,
                                date: new Date().toISOString().split('T')[0],
                                userId: chatId
                            };
                            
                            data.debtors.push(newDebtor);
                            saveData(data);
                            
                            // O'zgartirishlarni tozalash
                            delete userState[chatId];
                            
                            bot.sendMessage(chatId, `✅ Qarzdor qo'shildi!\n\n👤 Ism: ${newDebtor.name}\n📱 Telefon: ${newDebtor.phone}\n💰 Summa: ${formatNumber(newDebtor.amount)} so'm`);
                        }
                    });
                }
            });
        }
    });
});

// 10. Qarzdorlar ro'yxati
bot.onText(/📋 Qarzdorlar ro\'yxati/, (msg) => {
    const chatId = msg.chat.id;
    const data = readData();
    
    const userDebtors = data.debtors.filter(d => d.userId === chatId);
    
    if (userDebtors.length === 0) {
        bot.sendMessage(chatId, '📭 Hozircha qarzdorlar yo\'q');
        return;
    }
    
    let message = '📋 *Sizning qarzdorlaringiz:*\n\n';
    
    userDebtors.forEach((debtor, index) => {
        const remaining = debtor.amount - debtor.paid;
        message += `${index + 1}. ${debtor.name}\n`;
        message += `   📱: ${debtor.phone}\n`;
        message += `   💰: ${formatNumber(debtor.amount)} so'm\n`;
        message += `   💵 To'langan: ${formatNumber(debtor.paid)} so'm\n`;
        message += `   📊 Qolgan: ${formatNumber(remaining)} so'm\n`;
        message += `   📅 Sana: ${debtor.date}\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// 11. To'lov qilish
bot.onText(/💰 To\'lov qilish/, (msg) => {
    const chatId = msg.chat.id;
    const data = readData();
    
    const userDebtors = data.debtors.filter(d => d.userId === chatId);
    
    if (userDebtors.length === 0) {
        bot.sendMessage(chatId, '💵 To\'lov qilish uchun qarzdorlar yo\'q');
        return;
    }
    
    // Inline keyboard yaratish
    const buttons = userDebtors.map(debtor => {
        return [{
            text: `${debtor.name} - ${formatNumber(debtor.amount)} so'm`,
            callback_data: `pay_${debtor.id}`
        }];
    });
    
    bot.sendMessage(chatId, '💵 Qaysi qarzdor uchun to\'lov qilmoqchisiz?', {
        reply_markup: {
            inline_keyboard: buttons
        }
    });
});

// 12. Statistika
bot.onText(/📊 Statistika/, (msg) => {
    const chatId = msg.chat.id;
    const data = readData();
    
    const userDebtors = data.debtors.filter(d => d.userId === chatId);
    
    if (userDebtors.length === 0) {
        bot.sendMessage(chatId, '📈 Hozircha statistika yo\'q');
        return;
    }
    
    const totalAmount = userDebtors.reduce((sum, d) => sum + d.amount, 0);
    const totalPaid = userDebtors.reduce((sum, d) => sum + d.paid, 0);
    const totalRemaining = totalAmount - totalPaid;
    
    const message = `📊 *Statistika:*\n\n` +
        `👥 Jami qarzdorlar: ${userDebtors.length} ta\n` +
        `💰 Jami summa: ${formatNumber(totalAmount)} so'm\n` +
        `💵 To'langan: ${formatNumber(totalPaid)} so'm\n` +
        `📊 Qolgan: ${formatNumber(totalRemaining)} so'm\n` +
        `📈 To'lov foizi: ${Math.round((totalPaid / totalAmount) * 100)}%`;
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// 13. Callback query (to'lov uchun)
bot.on('callback_query', (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    if (data.startsWith('pay_')) {
        const debtorId = parseInt(data.split('_')[1]);
        const dbData = readData();
        const debtor = dbData.debtors.find(d => d.id === debtorId && d.userId === chatId);
        
        if (debtor) {
            const remaining = debtor.amount - debtor.paid;
            
            bot.sendMessage(chatId, `💰 *To'lov qilish*\n\nQarzdor: ${debtor.name}\nQolgan summa: ${formatNumber(remaining)} so'm\n\nTo'lov miqdorini kiriting (so'm):`, {
                parse_mode: 'Markdown'
            }).then(() => {
                bot.once('message', (paymentMsg) => {
                    if (paymentMsg.chat.id === chatId) {
                        const paymentAmount = parseInt(paymentMsg.text.replace(/\D/g, '')) || 0;
                        
                        if (paymentAmount <= 0 || paymentAmount > remaining) {
                            bot.sendMessage(chatId, `❌ Noto'g'ri summa! 1 dan ${formatNumber(remaining)} so'mgacha kiriting.`);
                            return;
                        }
                        
                        // To'lovni amalga oshirish
                        debtor.paid += paymentAmount;
                        saveData(dbData);
                        
                        bot.sendMessage(chatId, `✅ To'lov muvaffaqiyatli!\n\nSumma: ${formatNumber(paymentAmount)} so'm\nYangi qolgan summa: ${formatNumber(debtor.amount - debtor.paid)} so'm`);
                    }
                });
            });
        }
    }
    
    // Callback queryga javob berish
    bot.answerCallbackQuery(callbackQuery.id);
});

// 14. /help komandasi
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpText = `🆘 *Yordam*\n\n` +
        `*Komandalar:*\n` +
        `/start - Botni boshlash\n` +
        `/help - Yordam\n` +
        `/list - Qarzdorlar ro'yxati\n` +
        `/add [ism] [summa] - Yangi qarzdor\n\n` +
        `*Menyu orqali:*\n` +
        `➕ Qarzdor qo'shish - Yangi qarzdor\n` +
        `📋 Qarzdorlar ro'yxati - Barcha qarzdorlar\n` +
        `💰 To'lov qilish - Qarz to'lash\n` +
        `📊 Statistika - Umumiy statistika`;
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'Markdown' });
});

// 15. /list komandasi
bot.onText(/\/list/, (msg) => {
    const chatId = msg.chat.id;
    const data = readData();
    
    const userDebtors = data.debtors.filter(d => d.userId === chatId);
    
    if (userDebtors.length === 0) {
        bot.sendMessage(chatId, '📭 Qarzdorlar yo\'q');
        return;
    }
    
    let message = '📋 *Qarzdorlar:*\n\n';
    
    userDebtors.forEach((debtor, index) => {
        message += `${index + 1}. ${debtor.name} - ${formatNumber(debtor.amount)} so'm\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// 16. /add komandasi
bot.onText(/\/add (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const params = match[1].split(' ');
    
    if (params.length < 2) {
        bot.sendMessage(chatId, '❌ Format: /add [Ism] [Summa]\nMasalan: /add Ali 500000');
        return;
    }
    
    const name = params[0];
    const amount = parseInt(params[1]) || 0;
    
    if (amount <= 0) {
        bot.sendMessage(chatId, '❌ Summa noto\'g\'ri!');
        return;
    }
    
    const data = readData();
    
    const newDebtor = {
        id: Date.now(),
        name: name,
        phone: '000000000', // Telefon yo'q
        amount: amount,
        paid: 0,
        date: new Date().toISOString().split('T')[0],
        userId: chatId
    };
    
    data.debtors.push(newDebtor);
    saveData(data);
    
    bot.sendMessage(chatId, `✅ Qarzdor qo'shildi!\n\n👤 ${name}\n💰 ${formatNumber(amount)} so'm`);
});

// 17. Bot ishga tushdi
console.log('🤖 Bot ishga tushdi!');
console.log('✅ Token borligini tekshiring');
console.log('📁 debtors.json fayli yaratildi');