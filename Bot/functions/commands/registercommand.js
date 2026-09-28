async function getRegisteredCommandsCount(client) {
  if (!client) return 0;
  if (!client.application) return 0;

  try {
    await client.application.fetch();
    const commands = await client.application.commands.fetch();
    return commands.size;
  } catch (error) {
    console.error("Failed to fetch commands:", error);
    return 0;
  }
}

module.exports = { getRegisteredCommandsCount };
