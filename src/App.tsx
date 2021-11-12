import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import urls from "./urls";
import {
  Space,
  Col,
  Layout,
  Row,
  Slider,
  Tree,
  Button,
  Select,
  Divider,
  Input,
  Table,
  Popconfirm,
} from "antd";
import ReactPlayer from "react-player";
import { BaseReactPlayerProps } from "react-player/base";
import {
  SliderMarks,
  SliderRangeProps,
  SliderSingleProps,
} from "antd/lib/slider";
import {
  DownloadOutlined,
  PlusOutlined,
  SaveOutlined,
} from "@ant-design/icons";
interface TreeData {
  title: string | React.ReactElement;
  key: string;
  icon?: React.ReactElement;
  children?: TreeData[];
  switcherIcon?: React.ReactElement;
}
interface LabelTableData {
  range: [number, number];
  label: string;
  key: React.Key;
}
interface LabelMap {
  [label: string]: string;
}
type DirInfo = [path: string, folders: string[], files: string[]];
const speedTypeNumber = 6;
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
  const [fileData, setFileData] = useState<TreeData[]>([]);
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
    fetch(urls.label, { method: "GET" })
      .then((response) => response.json())
      .then((labelMap: LabelMap) => {
        setLabelMap(labelMap);
      });
  }, []);
  useEffect(() => {
    fetch(urls.files, { method: "GET" })
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
        const root = treedatas[0];
        return root.children ?? [];
      })
      .then(setFileData);
  }, []);

  const updateLabelTableData = (newLabelTableData: LabelTableData[]) => {
    let duration = playerRef.current?.getDuration() ?? 0;
    if (!(duration > 0)) {
      duration = 0;
    }
    const sliderRangeMarks = {
      0: "0",
      [duration]: duration.toString(),
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

  const onSelect = (selectedKeys: React.Key[], info: any) => {
    initValue();
    const newUrl = urls.video + "?file=" + encodeURIComponent(selectedKeys[0]);
    setVideoUrl(newUrl);
    setVideoKey(selectedKeys[0]);
    fetch(urls.videoLabel + "?file=" + encodeURIComponent(selectedKeys[0]), {
      method: "GET",
    })
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
    playerRef.current?.seekTo(getNewFromRange(newRange, oldRange));
    setSliderRange(newRange);
  };
  const onPlayerReady: BaseReactPlayerProps["onReady"] = (player) => {
    const videoDuration = player.getDuration();
    setSliderMax(videoDuration);
    if (!selectedAll) {
      const newSliderMarks = Object.assign({}, sliderMarks);
      Object.assign(newSliderMarks, {
        [videoDuration]: videoDuration.toString(),
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
    const newLabelMap = Object.assign({}, labelMap);
    const pos = label2Add.indexOf(":");
    const description =
      pos === -1 ? "No Description" : label2Add.substr(pos + 1);
    newLabelMap[label2Add.substr(0, pos)] = description;
    fetch(urls.label, {
      body: JSON.stringify(Object.assign({}, newLabelMap)),
      method: "PUT",
      headers: { "content-type": "application/json" },
    });
    setLabelMap(newLabelMap);
  };
  const onAddButtonClick: React.MouseEventHandler<HTMLElement> = () => {
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
      (item) => item.key != key
    );
    updateLabelTableData(newLabelTableData);
    fetch(urls.videoLabel, {
      body: JSON.stringify({ key: videoKey, data: newLabelTableData }),
      method: "PUT",
      headers: { "content-type": "application/json" },
    });
  };
  const changeVideoSpeed: SliderSingleProps["onChange"] = (value) => {
    setVideoPlaybackRate(Math.pow(2, value));
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
          <Tree onSelect={onSelect} treeData={fileData} />
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
              <Button type="primary" icon={<SaveOutlined />} />
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
                        <PlusOutlined /> 添加标签
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
