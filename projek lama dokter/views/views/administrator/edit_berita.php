<div class="content-wrapper">
    <section class="content-header">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-12">
                    <div class="card card-info">
                        <div class="card-header">
                            <h3 class="card-title">EDIT BERITA</h3>
                        </div>
                        <div class="card-body">
                            <form action="<?= site_url('Administrator/UbahBerita') ?>" method="post" enctype="multipart/form-data">
                                <table class="table table-stripped">
                                    <tr>
                                        <td width="150px">Judul Berita</td>
                                        <td><input type="text" name="judul" class="form-control" value="<?= $berita['judul'] ?>"></td>
                                    </tr>
                                    <tr>
                                        <td width="150px">Isi Berita</td>
                                        <td>
                                            <textarea class="textarea" rows="10" name="deskripsi" class="form-control">
                                                <?= $berita['deskripsi'] ?>
                                            </textarea>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td width="150px">Tanggal Berita</td>
                                        <td><input type="date" name="tgl" class="form-control" value="<?= $berita['tgl'] ?>"></td>
                                    </tr>
                                    <tr>
                                        <td width="150px">Penulis</td>
                                        <td><input type="text" name="author" class="form-control" value="<?= $berita['author'] ?>"></td>
                                    </tr>
                                    <tr>
                                        <td>File Photo</td>
                                        <td>
                                            <img src="<?= base_url() ?>assets/img/berita/<?= $berita['gambar'] ?>" width="350px" alt=""><br>
                                            <input type="file" name="gambar" class="form-control">
                                        </td>
                                    </tr>

                                    <tr>
                                        <td colspan="2">
                                            <input type="hidden" name="id" value="<?= $berita['id'] ?>">
                                            <button type="submit" class="btn btn-info"><i class="fas fa-save"></i> Simpan</button>
                                            <a href="<?= site_url('Administrator/berita') ?>" class="btn btn-danger" id="tblback"><i class="fas fa-reply"></i> Kembali</a>
                                        </td>
                                    </tr>
                                </table>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</div>