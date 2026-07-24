module.exports = async (client, message, state, idUser) => {
  if (message.author.id !== idUser) return;
  if (message.content !== "pause") return;

  if (state.paused) {
    console.log("⏸️ Bot đang pause rồi");
    return;
  }

  state.paused = true;
  await message.edit("stops");
  console.log("⏸️ Pause thủ công");
};