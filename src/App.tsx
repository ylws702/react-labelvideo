import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import urls from "./urls";
import {
  Button,
  Col,
  Divider,
  Input,
  Layout,
  notification,
  Popconfirm,
  Row,
  Select,
  Slider,
  Space,
  Table,
  Tree,
} from "antd";
import ReactPlayer from "react-player";
import { BaseReactPlayerProps } from "react-player/base";
import {
  SliderMarks,
  SliderRangeProps,
  SliderSingleProps,
} from "antd/lib/slider";
import { TreeProps } from "antd/lib/tree";
import {
  DownloadOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import localforage from "localforage";
interface TreeData {
  children?: TreeData[];
  isLeaf: boolean;
  key: string;
  switcherIcon?: React.ReactElement;
  title: string | React.ReactElement;
}
interface LabelTableData {
  key: React.Key;
  label: string;
  range: [number, number];
}
interface LabelMap {
  [label: string]: string;
}
type DirInfo = [path: string, folders: string[], files: string[]];
const speedTypeNumber = 6;
const storageKeys = {
  videoKey: "videoKey",
  videoPlaybackRate: "videoPlaybackRate",
};

function fetchWithTimeout(
  resource: RequestInfo,
  options: Omit<RequestInit, "signal"> & { timeout?: number }
) {
  return new Promise<Response>((resolve, reject) => {
    const { timeout = 30000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => {
      controller.abort();
      reject(new Error("timeout"));
    }, timeout);
    fetch(resource, {
      ...options,
      signal: controller.signal,
    }).then((response) => {
      clearTimeout(id);
      resolve(response);
    });
  });
}

function App() {
  const videoInitValue = {
    labelTableData: [],
    selectedAll: false,
    selectedRowKey: null,
    sliderMarks: {
      0: "0",
    },
    sliderMax: 0,
    sliderRange: [0, 0] as [number, number],
    videoUrl: "",
    videoKey: "/",
    videoPlaying: true,
  };
  const [expandedFileKeys, setExpandedFileKeys] = useState<React.Key[]>([]);
  const [fileData, setFileData] = useState<TreeData[]>([]);
  const [fileTree, setFileTree] = useState(<div />);
  const [isFileDataLoading, setIsFileDataLoading] = useState<boolean>(true);
  const [label2Add, setLabel2Add] = useState<string>("");
  const [labelMap, setLabelMap] = useState<LabelMap>({});
  const [labelTableData, setLabelTableData] = useState<LabelTableData[]>(
    videoInitValue.labelTableData
  );
  const [selectedAll, setSelectedAll] = useState<boolean>(
    videoInitValue.selectedAll
  );
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [selectedRowKey, setSelectedRowKey] = useState<React.Key | null>(
    videoInitValue.selectedRowKey
  );
  const [sliderMarks, setSliderMarks] = useState<SliderMarks>(
    videoInitValue.sliderMarks
  );
  const [sliderMax, setSliderMax] = useState(videoInitValue.sliderMax);
  const [sliderRange, setSliderRange] = useState<[number, number]>(
    videoInitValue.sliderRange
  );
  const [videoPlaybackRate, setVideoPlaybackRate] = useState<number>(1.0);
  const [videoUrl, setVideoUrl] = useState<string>(videoInitValue.videoUrl);
  const [videoKey, setVideoKey] = useState<React.Key>(videoInitValue.videoKey);
  const [videoPlaying, setVideoPlaying] = useState<boolean>(
    videoInitValue.videoPlaying
  );
  const initValue = () => {
    for (const property in videoInitValue) {
      const funcName = `set${property[0].toUpperCase()}${property.slice(1)}`;
      eval(`${funcName}(videoInitValue.${property})`);
    }
    // setLabelTableData(videoInitValue.labelTableData);
    // setSelectedRowKey(videoInitValue.selectedRowKey);
    // setSliderMarks(videoInitValue.sliderMarks);
    // setSliderMax(videoInitValue.sliderMax);
    // setSliderRange(videoInitValue.sliderRange);
    // setVideoUrl(videoInitValue.videoUrl);
    // setVideoKey(videoInitValue.videoKey);
  };
  const playerRef = useRef<ReactPlayer>(null);
  useEffect(() => {
    fetchWithTimeout(urls.label, { method: "GET" })
      .then((response) => response.json())
      .then((labelMap: LabelMap) => {
        setLabelMap(labelMap);
      });
  }, []);
  useEffect(() => {
    fetchWithTimeout(urls.files, { method: "GET" })
      .then((response) => response.json())
      .then((unorderedFiles: DirInfo[]) => {
        const strSort = (str0: string, str1: string) =>
          str0.localeCompare(str1);
        const files: DirInfo[] = unorderedFiles
          .sort((dirInfo0, dirInfo1) => strSort(dirInfo0[0], dirInfo1[0]))
          .map(([path, folders, files]) => [
            path,
            folders.sort(strSort),
            files.sort(strSort),
          ]);
        const prefix = files[0][0].split("/").filter(Boolean);
        const prefixLen = prefix.length;

        const treedatas = files.map<TreeData>((file, i) => {
          if (i === 0) {
            return {
              title: "Root",
              key: "/",
              children: [],
              isLeaf: false,
            };
          }
          const path = file[0].split("/").filter(Boolean);
          const realtivePath = path.slice(prefixLen);
          return {
            title: realtivePath[realtivePath.length - 1],
            key: realtivePath.map((x) => "/" + x).join(""),
            children: [],
            isLeaf: false,
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
              isLeaf: true,
            })
          );
        });
        const root = treedatas[0];
        return root.children ?? [];
      })
      .then((newFileData) => {
        localforage
          .getItem<string>(storageKeys.videoKey)
          .then((storedVideoKey) => {
            console.log("storedVideoKey", storedVideoKey);
            const newExpandedFilesKeys = Array.from(expandedFileKeys);
            if (storedVideoKey) {
              setVideoKey(storedVideoKey);
              if (expandedFileKeys.indexOf(storedVideoKey) === -1) {
                const getParent = (key: string): string[] => {
                  return Array.from<string, [string, number]>(key, (v, k) => [
                    v,
                    k,
                  ])
                    .filter(([v, k]) => v === "/" && k !== 0)
                    .map(([v, k]) => key.substr(0, k));
                };
                newExpandedFilesKeys.push(...getParent(storedVideoKey));
                setExpandedFileKeys(newExpandedFilesKeys);
              }
              onSelect([storedVideoKey], { node: { isLeaf: true } });
              setIsFileDataLoading(false);
            }
          })
          .then(() => {
            setFileData(newFileData);
          });
      });
  }, []);

  const updateLabelTableData = (newLabelTableData: LabelTableData[]) => {
    let duration = playerRef.current?.getDuration() ?? 0;
    if (!(duration > 0)) {
      duration = 0;
    }
    const sliderRangeMarks = {
      0: "0",
      [duration]: duration.toFixed(3),
    };
    for (const labelData of newLabelTableData) {
      const [a, b] = labelData.range;
      Object.assign(sliderRangeMarks, {
        [a]: `${labelData.label}-`,
        [b]: `${labelData.label}+`,
      });
    }
    setSliderMarks(sliderRangeMarks);
    setLabelTableData(newLabelTableData);
  };

  const onSelect = (
    selectedKeys: React.Key[],
    info: { node: { isLeaf: boolean } }
  ) => {
    if (!info.node.isLeaf) return;
    initValue();
    const [selectedKey] = selectedKeys;
    localforage.setItem(storageKeys.videoKey, selectedKey);
    const newUrl = urls.video + "?file=" + encodeURIComponent(selectedKey);
    setVideoUrl(newUrl);
    setVideoKey(selectedKeys[0]);
    fetchWithTimeout(
      urls.videoLabel + "?file=" + encodeURIComponent(selectedKey),
      {
        method: "GET",
      }
    )
      .then((response) => response.json())
      .then((json: Omit<LabelTableData, "key">[]) => {
        updateLabelTableData(
          json.map((item, i) => ({ ...item, key: `${item.label}-${i}` }))
        );
      });
  };

  const getNewFromRange = (
    newRange: [number, number],
    oldRange: [number, number]
  ) => {
    return newRange[0] === oldRange[0] || newRange[0] === oldRange[1]
      ? newRange[1]
      : newRange[0];
  };
  const onSliderChange: SliderRangeProps["onChange"] = (newRange) => {
    const oldRange = sliderRange;
    const player = playerRef.current;
    setVideoPlaying(false);
    if (!player) {
      return;
    }
    player.seekTo(getNewFromRange(newRange, oldRange), "seconds");
    setSliderRange(newRange);
  };
  const changeVideoSpeed: SliderSingleProps["onChange"] = (value) => {
    setVideoPlaybackRate(Math.pow(2, value));
    console.log("changeVideoSpeed", value);
  };
  const onPlayerReady: BaseReactPlayerProps["onReady"] = (player) => {
    const videoDuration = player.getDuration();
    setSliderMax(videoDuration);
    if (!selectedAll) {
      const newSliderMarks = Object.assign({}, sliderMarks);
      Object.assign(newSliderMarks, {
        [videoDuration]: videoDuration.toFixed(3),
      });
      setSliderMarks(newSliderMarks);
      setSliderRange([0, videoDuration]);
      setSelectedAll(true);
    }
  };
  const onLabel2AddInputChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    setLabel2Add(e.target.value);
  };
  const addLabel: React.DOMAttributes<HTMLAnchorElement>["onClick"] = () => {
    if (!(label2Add.length > 0)) {
      notification.error({
        message: "添加预置标注失败",
        description: "标注为空",
      });
      return;
    }
    const newLabelMap = Object.assign({}, labelMap);
    const pos = label2Add.indexOf(":");
    const description =
      pos === -1 ? "No Description" : label2Add.substr(pos + 1);
    newLabelMap[label2Add.substr(0, pos)] = description;
    fetchWithTimeout(urls.label, {
      body: JSON.stringify(Object.assign({}, newLabelMap)),
      method: "PUT",
      headers: { "content-type": "application/json" },
    }).catch((e: Error) => {
      const message =
        e.message === "timeout" ? "连接超时" : "无法保存标注至服务器";
      notification.error({
        message,
        description: "当前标注信息会在刷新后丢失",
        duration: 8,
      });
    });
    setLabel2Add("");
    setLabelMap(newLabelMap);
  };
  const onAddButtonClick: React.MouseEventHandler<HTMLElement> = () => {
    if (!(selectedLabel.length > 0)) {
      notification.error({
        message: "添加标注失败",
        description: "未选择标注",
      });
      return;
    }
    const newLabelTableData = Array.from(labelTableData).concat({
      range: sliderRange,
      label: selectedLabel,
      key: `${selectedLabel}-${labelTableData.length}`,
    });
    updateLabelTableData(newLabelTableData);
    fetch(urls.videoLabel, {
      body: JSON.stringify({ key: videoKey, data: newLabelTableData }),
      method: "PUT",
      headers: { "content-type": "application/json" },
    });
  };
  const onDeleteVideoLabel = (key: React.Key) => {
    const newLabelTableData = Array.from(labelTableData).filter(
      (item) => item.key !== key
    );
    updateLabelTableData(newLabelTableData);
    fetch(urls.videoLabel, {
      body: JSON.stringify({ key: videoKey, data: newLabelTableData }),
      method: "PUT",
      headers: { "content-type": "application/json" },
    });
  };
  const onSelectedRowChange = (record: LabelTableData) => {
    setSelectedRowKey(record.key);
    const newSliderMarks: SliderMarks = {};
    for (const key of Object.keys(sliderMarks)) {
      newSliderMarks[Number(key)] = key;
    }
    for (const timestamp of record.range) {
      newSliderMarks[timestamp] = {
        style: {
          color: "#f50",
        },
        label: <strong>{timestamp}</strong>,
      };
    }
    setSliderMarks(newSliderMarks);
  };
  return (
    <div className="App">
      <Layout>
        <Layout.Sider className="App-sider">
          <Tree.DirectoryTree
            autoExpandParent={!isFileDataLoading}
            onSelect={onSelect as TreeProps["onSelect"]}
            treeData={fileData}
            // expandedKeys={expandedFileKeys}
            // selectedKeys={[videoKey]}
          />
        </Layout.Sider>
        <Layout.Content className="App-content">
          <ReactPlayer
            url={videoUrl}
            width="100%"
            ref={playerRef}
            onReady={onPlayerReady}
            playbackRate={videoPlaybackRate}
            playing={videoPlaying}
            controls
          />
          <Row>
            <Col flex="1 1 auto">
              <Slider
                style={{ margin: "24px" }}
                range
                defaultValue={[0, 0]}
                step={0.01}
                onChange={onSliderChange}
                marks={sliderMarks}
                max={sliderMax}
                value={sliderRange}
              />
            </Col>
          </Row>
          <Row>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={onAddButtonClick}
              />
              <Button type="primary" icon={<DownloadOutlined />} />
              <Select
                style={{ width: 240 }}
                onChange={(value: string, option) => {
                  setSelectedLabel(value);
                }}
                placeholder="请选择标注"
                dropdownRender={(menu) => (
                  <div>
                    {menu}
                    <Divider style={{ margin: "4px 0" }} />
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "nowrap",
                        padding: 8,
                      }}
                    >
                      <Input
                        style={{ flex: "auto" }}
                        value={label2Add}
                        onChange={onLabel2AddInputChange}
                        placeholder="标注:描述"
                      />
                      <a
                        style={{
                          flex: "none",
                          padding: "8px",
                          display: "block",
                          cursor: "pointer",
                        }}
                        onClick={addLabel}
                      >
                        <PlusOutlined /> 添加标注
                      </a>
                    </div>
                  </div>
                )}
              >
                {Object.entries(labelMap).map(([item, description]) => (
                  <Select.Option key={item} value={item}>
                    {item + ": " + description}
                  </Select.Option>
                ))}
              </Select>

              <Slider
                style={{ width: "20em" }}
                marks={Array.from({ length: speedTypeNumber }, (_, k) =>
                  Math.pow(2, k - 1)
                ).reduce(
                  (o, v, k) => (Object.assign(o, { [k - 1]: `${v}x` }), o),
                  {}
                )}
                tipFormatter={(value) =>
                  value !== undefined && `${Math.pow(2, value)}x`
                }
                step={null}
                defaultValue={2}
                min={-1}
                max={speedTypeNumber - 2}
                onChange={changeVideoSpeed}
                value={Math.log2(videoPlaybackRate)}
              />
            </Space>
          </Row>
          <Table
            rowSelection={{
              type: "radio",
              onChange: (selectedRowKeys) => {
                selectedRowKeys.length === 1 &&
                  setSelectedRowKey(selectedRowKeys[0]);
              },
              selectedRowKeys: selectedRowKey ? [selectedRowKey] : [],
            }}
            onRow={(record) => ({ onClick: () => onSelectedRowChange(record) })}
            dataSource={labelTableData}
            columns={[
              {
                title: "时间",
                dataIndex: "range",
                key: "range",
                render: (range: [number, number]) => {
                  function padNumber(num: number, len: number) {
                    return num.toString().padStart(len, "0");
                  }
                  function time2str(time: number) {
                    const date = new Date(time * 1000);
                    const ms = padNumber(date.getUTCMilliseconds(), 3);
                    const s = padNumber(date.getUTCSeconds(), 2);
                    const m = padNumber(date.getUTCMinutes(), 2);
                    const h = date.getUTCHours();
                    return `${h}:${m}:${s}.${ms}`;
                  }
                  return `${time2str(range[0])} - ${time2str(range[1])}`;
                },
              },
              {
                title: "标注",
                dataIndex: "label",
                key: "label",
              },
              {
                title: "操作",
                dataIndex: "operation",
                render: (_, record) => {
                  if (labelTableData.length >= 1) {
                    return (
                      <Popconfirm
                        title="确认删除?"
                        onConfirm={() => onDeleteVideoLabel(record.key)}
                      >
                        <a>删除</a>
                      </Popconfirm>
                    );
                  }
                },
              },
            ]}
          ></Table>
        </Layout.Content>
      </Layout>
    </div>
  );
}

export default App;
