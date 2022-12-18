// shutdown handler todo
process.on("unhandledRejection", (error) => {
    console.error(`unhandledRejection`, error);
    setTimeout(() => process.exit(), 3000);
});
  
process.on("uncaughtException", (error) => {
    console.error(error);
    setTimeout(() => process.exit(), 3000);
});
