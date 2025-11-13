const { PrismaClient } = require("../generated/prisma/client");
const readline = require("readline-sync");
const colors = require("colors");
const bcrypt = require("bcrypt");

const db = new PrismaClient();

const start = async () => {
  console.log(
    "NOTICE: This utility is to be used for the express purpose of creating THE FIRST admin user on the database. All other users should be created through Firefly."
      .bgYellow.bold
  );
  if (!readline.keyInYN("Do you want to continue?")) {
    process.exit();
  }

  const name = readline.question("Enter name: ");

  const email = readline.questionEMail("Enter e-mail: ");

  // const username = readline.question("Enter username: ");

  const password = readline.questionNewPassword("Enter new password: ", {
    confirmMessage: "Confirm new password: ",
    unmatchMessage:
      "The passwords do not match, please confirm again. (Press RETURN to go back to the first password step): ",
  });

  console.log("---+ ENTERED INFORMATION +---");
  console.log("Name: ", name.bold);
  console.log("E-mail: ", email.bold);
  console.log("Password: ", "*".repeat(password.length).bold);

  const confirmation = readline.keyInYNStrict(
    "Are you sure you want to create a new admin user with these credentials?"
  );

  if (!confirmation) {
    console.log("Aborting...");
    process.exit();
  }

  // 12 salt rounds
  const hashedPassword = await bcrypt.hash(password, 12);

  console.log("Contacting database...");
  try {
    await db.user.create({
      data: {
        email,
        role: "admin",
        password: hashedPassword,
        profile: {
          create: {
            name,
          },
        },
      },
    });

    console.log("User was created sucessfully! :)".green);
  } catch (err) {
    console.error("There was an error creating the user: ".red.bold);
    console.trace(err);
  }
};

start();
