async function handleIncomingMessage(message: Message) {
  let messageString = message.body;

  if (flightRegex.test(messageString)) {
    const matches = messageString.match(flightRegex);

    if (matches) {
      let from = matches[1] ? getCountryCode(matches[1]) : null;
      let to = matches[2] ? getCountryCode(matches[2]) : null;
      let date = matches[3] || null;

      if (!from || !to || !date) {
        await message.reply(from ? "من؟" : "إلى؟");
        const messageCollector = new MessageCollector(message.client, {
          time: 30000,
          jid: message.from,
          maxMsgs: 1,
          filter: (collectedMessage) => collectedMessage.from === message.from,
        });

        messageCollector.on("collect", async (collectedMessage) => {
          if (!from) {
            from = getCountryCode(collectedMessage.body.trim());
            await message.reply("إلى؟");
          } else if (!to) {
            to = getCountryCode(collectedMessage.body.trim());
            await message.reply("أي تاريخ؟");
          } else if (!date) {
            date = collectedMessage.body.trim();
            messageCollector.stop();
          }
        });

        messageCollector.once('end', async (collected, reason) => {
          if (reason === 'limit') {
            if (from && to && date) {
              try {
                const flightResults = await searchFlights(from, to, date);
                await message.reply(flightResults);
              } catch (error) {
                console.error(error);
                await message.reply("عذراً، حدث خطأ أثناء البحث عن الرحلات. يرجى المحاولة مرة أخرى.");
              }
            }
          }
        });
      }
    }
  } else if (message.body === ".رحله") {
    await message.reply("من؟");
    const messageCollector = new MessageCollector(message.client, {
      time: 60000,
      filter: (collectedMessage) => collectedMessage.from === message.from,
    });

    let step = 1;
    let from, to, date;

    messageCollector.on("collect", async (collectedMessage) => {
      if (step === 1) {
        from = getCountryCode(collectedMessage.body.trim());
        step++;
        await message.reply("إلى؟");
      } else if (step === 2) {
        to = getCountryCode(collectedMessage.body.trim());
        step++;
        await message.reply("أي تاريخ؟");
      } else if (step === 3) {
        date = collectedMessage.body.trim();
        step++;

        try {
          const flightResults = await searchFlights(from, to, date);
          await message.reply(flightResults);
        } catch (error) {
          console.error(error);
          await message.reply("عذراً، حدث خطأ أثناء البحث عن الرحلات. يرجى المحاولة مرة أخرى.");
        }

        messageCollector.stop();
      }
    });

    messageCollector.once('end', async (collected, reason) => {
      if (reason === 'time') {
        await message.reply('عذراً، لقد انتهى الوقت المخصص لهذا الطلب. يرجى المحاولة مرة أخرى.');
      }
    });
  }
