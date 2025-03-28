import express, { Request, Response } from "express";

export const getUsers: express.RequestHandler = async (
  req: Request,
  res: Response
) => {
  res
    .status(200)
    .json({
      message:
        "This route is protected with authentication. If you can access it, then that means you are authenticated!",
    });
};
