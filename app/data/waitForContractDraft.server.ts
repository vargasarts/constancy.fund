import fs from "fs";
import path from "path";
import { FE_PUBLIC_DIR } from "fuegojs/dist/common";

const doesContractExist =
  process.env.NODE_ENV === "development"
    ? (uuid: string) =>
        Promise.resolve(
          fs.existsSync(
            path.join(FE_PUBLIC_DIR, `_contracts/${uuid}/draft.pdf`)
          )
        )
    : (uuid: string) =>
        import("aws-sdk")
          .then((AWS) => new AWS.S3())
          .then((s3) =>
            s3
              .headObject({
                Bucket: (process.env.HOST || "").replace(/^https?:\/\//, ""),
                Key: `_contracts/${uuid}/draft.pdf`,
              })
              .promise()
          )
          .then(() => true)
          .catch(() => false);

const waitForContract = (uuid: string, trial = 0): Promise<boolean> =>
  doesContractExist(uuid).then((exists) => {
    if (exists) {
      return true;
    } else if (trial < 100) {
      return new Promise((resolve) =>
        setTimeout(() => resolve(waitForContract(uuid, trial + 1)), 100)
      );
    } else {
      return Promise.reject(false);
    }
  });

export default waitForContract;
