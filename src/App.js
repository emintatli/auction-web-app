import "./main.scss";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { uuid } from "uuidv4";
import Countdown from "react-countdown";

function App() {
  const socket = io("https://auction-case-study-server.herokuapp.com");
  const getAuctions = async () => {
    setAuctionLoading(true);
    const req = await fetch("https://auction-case-study-server.herokuapp.com/get");
    const res = await req.json();
    setAuction_products(res);
    setAuctionLoading(false);
  };
  const [auctionLoading, setAuctionLoading] = useState(false);
  const [auction_products, setAuction_products] = useState([]);
  const bid_input = useRef();
  const [bids, setBids] = useState([]);
  const [max_bid, setMax_bid] = useState([]);
  const [uuids, setUuids] = useState("");
  const [current_product, setCurrent_product] = useState("");
  const [bid_status, setBid_status] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const bidder = (msg) => {
      bid_status !== "timeout" &&
        setBids([
          ...bids,
          {
            bid: parseInt(msg.bid),
            from: msg.from,
            time: msg.time,
            product_name: msg.product_name,
          },
        ]);
    };
    socket.on("bid_loading", (msg) => {
      setLoading(msg.status);
    });
    socket.on("bid_status", (msg) => {
      setBid_status({status:msg.status,user:msg.user});
    });
    socket.on("bid", bidder);
    return () => {
      socket.off("bid", bidder);
    };
  }, [bids]); // socket den veri gelince useEffect ile state de güncelleme yapıyorum

  useEffect(()=>{
    console.log(bid_status)
  },[bid_status])

  useEffect(async () => {
    if (!localStorage.getItem("uuid")) {
      localStorage.setItem("uuid", uuid());
      setUuids(localStorage.getItem("uuid")); // kullanıcı id sini localstorage a kayıt ediyorum, varsa yüklüyorum.
    } else {
      setUuids(localStorage.getItem("uuid"));
    }

    await getAuctions(); // sayfa ilk açıldğında back ende istek yolluyorum ürünleri çekiyor
  }, []);

  useEffect(async () => {
    await getAuctions();
    const max_bid = auction_products
      .filter((value) => value.auction_id === current_product)
      .map((v) => v.max_bid);
    let max_bids = [
      {
        current_product: current_product,
        max_bid: max_bid[0],
      },
    ];

    setMax_bid(max_bids);
  }, [current_product]);

  useEffect(() => {
    const max_bids = [
      {
        current_product: current_product,
        max_bid: Math.max(
          0,
          ...bids
            .filter((v) => v.product_name === current_product)
            .map((v) => parseInt(v.bid))
        ),
      },
    ];
    setMax_bid(max_bids);
  }, [bids]);

  const sendBid = () => {
    socket.emit("bid", {
      bid: bid_input.current.value,
      from: localStorage.getItem("uuid"),
      product: current_product,
    });
    bid_input.current.value = "";
  }; // kullanıcı teklif girdiğinde canlı takip içni socket e yolluyorum

  return (
    <>
      <div className="card mb-5">
        <div className="card-body">
          <p>Açık arttırmada olan ürünler:</p>
          <ul className="d-flex align-items-center justify-content-center">
            {/* sadece süresi geçmemiş açık arttırmaların gösterilmesi için filtre */}

            {auction_products
              .filter((value) => value.auction_end_time > Date.now())
              .map((v) => (
                <li key={v.auction_id} className="bid-list m-2">
                  <div
                    onClick={() => {
                      setCurrent_product(v.auction_id);
                    }}
                    className="card"
                  >
                    <div
                      id={v.auction_id}
                      className={`card-body d-flex flex-column align-items-center pointer ${
                        v.auction_id === current_product && "active"
                      }`}
                    >
                      <img
                        src="./digger.png"
                        width="100px"
                        height="100px"
                      ></img>
                      <p>{v.product_name}</p>
                      <p>
                        Açık arttırma bitmesine son <br />
                        <b>
                          <Countdown date={v.auction_end_time} />
                        </b>
                      </p>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      </div>
      {bid_status.status === "success" && (
        <>
          <div class={`alert ${bid_status.user===uuids?"alert-success":"alert-info"}`} role="alert">
        {` ${bid_status.user===uuids?"Teklifiniz kayıt edildi!":"Başka bir kullanıcı teklifi arttırdı!"}`}
          </div>
        </>
      )}
      {bid_status.status === "timeout" &&  (
        <>
        {bid_status.user===uuids&&<div class="alert alert-danger" role="alert">Açık arttırma süresi doldu!</div>}

        </>
      )}
      <div className="card">
        <div className="card-body d-flex flex-column align-items-center">
          {auctionLoading ? (
            <>
              <div class="spinner-border text-primary m-2" role="status"></div>
            </>
          ) : current_product ? (
            <>
              <p className="fs-3">
                Maksimum Teklif :{" "}
                <b>
                  {Math.max(
                    0,
                    ...(bids &&
                      bids.map(
                        (v) => v.product_name === current_product && v.bid
                      ))
                  ) !== 0 &&
                    Math.max(
                      0,
                      ...(bids &&
                        bids.map(
                          (v) => v.product_name === current_product && v.bid
                        ))
                    )}
                  {Math.max(
                    0,
                    ...(bids &&
                      bids.map(
                        (v) => v.product_name === current_product && v.bid
                      ))
                  ) === 0 &&
                    max_bid !== [] &&
                    max_bid[0] !== undefined &&
                    max_bid[0].max_bid}
                  {/* burası çok uğraştırdı :D neden bu kadar zorladı bilmiyorum ama biraz karışık bi çözüm 
      oldu socket üzerinden geçerli bir max bid değeri geiyor ise maksimum değeri 
      alıp maksimum teklif kısmında gösteriyor , zaten DB deki maximum değerden düşük bir değer backend tarafında socket a alınmıyor.
      sonrasında eğer geçerli olmayan veya hiç olmayan bir socket değeri varsa bunun yerine db den gelen son veriyi çekiyor ve yerleştiriyor. */}
                  TL
                </b>
              </p>{" "}
              <div className="d-flex align-items-center">
                <input ref={bid_input} type="number"></input>
                <button
                  onClick={sendBid}
                  type="button"
                  class={`btn btn-primary ms-2 ${
                    loading === "true" ? "disabled" : ""
                  }`}
                >
                  Teklif Ver
                </button>
              </div>
            </>
          ) : (
            <p>Teklif yapmak için lütfen ürün seçiniz.</p>
          )}

          <div className="card mt-2 w-100">
            <div className="card-body d-flex align-items-center flex-column">
              Yapılan Teklifler
              <ul>
                {/* sadece ilgili tekliflerin gözükmesi için filtre */}
                {bids &&
                  bids.map(
                    (v) =>
                      v.product_name === current_product && (
                        <li className="bid-list fs-5 card m-1 p-2">
                          {" "}
                          <span className="product-uuid">
                            {v.product_name}
                          </span>{" "}
                          {v.bid} TL{" "}
                        </li>
                      )
                  )}
              </ul>
            </div>
          </div>
          <span className="text-secondary">Kullanıcı : {uuids && uuids}</span>
        </div>
      </div>
    </>
  );
}

export default App;
