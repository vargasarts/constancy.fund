import getMysql from "./mysql.server";
import { NotFoundError, MethodNotAllowedError } from "aws-sdk-plus/dist/errors";

const deleteFundraiseData = ({
  uuid,
  userId,
}: {
  uuid: string;
  userId: string;
}) =>
  getMysql().then(({ execute, destroy }) => {
    return execute(`SELECT c.userId FROM contract c WHERE c.uuid = ?`, [uuid])
      .then((results) => {
        const [contract] = results as { userId: string }[];
        if (!contract)
          throw new NotFoundError(`Could not find contract ${uuid}`);
        if (userId !== contract.userId)
          throw new MethodNotAllowedError(`Not authorized to delete ${uuid}`);
        return Promise.all([
          execute(`DELETE FROM contractdetail WHERE contractUuid = ?`, [uuid]),
          execute(`DELETE FROM agreement WHERE contractUuid = ?`, [uuid]),
          execute(`DELETE FROM contractclause WHERE contractUuid = ?`, [uuid]),
        ])
          .then(() => execute(`DELETE FROM contract WHERE uuid = ?`, [uuid]))
          .then(destroy);
      })
      .then(() => ({ success: true }));
  });

export default deleteFundraiseData;
