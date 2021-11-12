import React, { useEffect, useState } from "react";
import { Tree } from "antd";

import "./Explorer.css";
import urls from "./urls";

interface TreeData {
  title: string | React.ReactElement;
  key: string;
  icon?: React.ReactElement;
  children?: TreeData[];
  switcherIcon?: React.ReactElement;
}

const Explorer: React.FC<{}> = () => {
  const [fileData, setFileData] = useState<TreeData[]>([]);

  const onSelect = (selectedKeys: React.Key[], info: any) => {
    console.log("selected", selectedKeys, info);
  };

  type DirInfo = [path: string, folders: string[], files: string[]];
  useEffect(() => {
    fetch(urls.files)
      .then((response) => response.json())
      .then((files: DirInfo[]) => {
        const prefix = files[0][0].split("/").filter(Boolean);
        const prefixLen = prefix.length;

        const treedatas = files.map<TreeData>((file, i) => {
          if (i === 0) {
            return {
              title: "Root",
              key: "/",
              children: [],
            };
          }
          const path = file[0].split("/").filter(Boolean);
          const realtivePath = path.slice(prefixLen);
          return {
            title: realtivePath[realtivePath.length - 1],
            key: realtivePath.map((x) => "/" + x).join(""),
            children: [],
          };
        });
        files.forEach((file, i) => {
          const folders = file[1];
          const children = treedatas[i].children;
          for (let j = 0; j < folders.length; j++) {
            const key2find = treedatas[i].key
              .split("/")
              .filter(Boolean)
              .concat(folders[j])
              .map((x) => "/" + x)
              .join("");

            children!.push(treedatas.find((x) => x.key === key2find)!);
          }
          const fileNames = file[2];
          fileNames.forEach((fileName) =>
            children!.push({
              title: fileName,
              key: treedatas[i].key + "/" + fileName,
            })
          );
        });
        const root = JSON.parse(JSON.stringify(treedatas[0]));
        console.log(root);
        return [root];
      })
      .then(setFileData);
  }, []);

  return (
    <div>
      <Tree onSelect={onSelect} treeData={fileData} />
    </div>
  );
};

export default Explorer;
